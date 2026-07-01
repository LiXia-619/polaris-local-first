import type { AssistantToolAction } from './assistantToolProtocolTypes';
import { extractCodeBlocksFromMessage } from '../codeCardEngine';
import { stripCodeBlocksFromMessage } from '../codeCardText';
import { normalizeReplySpacing } from '../replyText';
import type { ThemeToolMode } from '../../types/domain';
import { extractCanonicalAssistantToolItems } from './assistantToolProtocolCanonicalizer';
import { parseAssistantToolAction } from './assistantToolProtocolActionParser';
import { parseToolPayload } from './assistantToolProtocolPayload';
import type { AssistantToolActionParseContext } from './assistantToolProtocolActionContext';

const ASSISTANT_TOOL_CALL_TRANSCRIPT_MARKER =
  /\[\s*assistant(?:[\s_-]*)tool(?:[\s_-]*)calls\s*\]/i;

function isRecoverableCreativeCssBlock(block: ReturnType<typeof extractCodeBlocksFromMessage>[number]) {
  if (!block.code.trim()) {
    return false;
  }
  if (block.language === 'css') {
    return true;
  }

  return (
    block.language === 'text'
    && /(?:^|\n)\s*[@.#:[\]\w-][^{\n]*\{[\s\S]*?:[\s\S]*?\}/.test(block.code)
  );
}

export function recoverCreativeCssToolAction(displayContent: string, themeToolMode: ThemeToolMode) {
  if (themeToolMode !== 'creative') {
    return null;
  }

  const cssBlocks = extractCodeBlocksFromMessage(displayContent).filter(isRecoverableCreativeCssBlock);
  if (cssBlocks.length !== 1) {
    return null;
  }

  const css = cssBlocks[0]?.code.trim();
  if (!css) {
    return null;
  }

  return {
    displayContent,
    actions: [{
      kind: 'appendThemeCss',
      css
    } satisfies AssistantToolAction],
    issues: []
  };
}

function looksLikeRecoverableJsonToolPayload(content: string) {
  const trimmed = content.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
    || (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

export function recoverLooseJsonToolActions(
  displayContent: string,
  themeToolMode: ThemeToolMode,
  parseContext?: AssistantToolActionParseContext
) {
  const parseRecoveredPayload = (rawPayload: string, nextDisplayContent: string) => {
    try {
      const parsedPayload = parseToolPayload(rawPayload);
      const payloadItems = extractCanonicalAssistantToolItems(parsedPayload);
      if (payloadItems.length === 0) {
        return null;
      }

      const actions: AssistantToolAction[] = [];
      const issues: string[] = [];
      for (const item of payloadItems) {
        const result = parseAssistantToolAction(item, nextDisplayContent, themeToolMode, parseContext);
        if (result.action) {
          actions.push(result.action);
        } else if (result.issue) {
          issues.push(result.issue);
        }
      }

      if (actions.length === 0 && issues.length === 0) {
        return null;
      }

      return {
        displayContent: nextDisplayContent,
        actions,
        issues: Array.from(new Set(issues))
      };
    } catch {
      return null;
    }
  };

  const codeBlocks = extractCodeBlocksFromMessage(displayContent);
  const jsonBlocks = codeBlocks.filter((block) =>
    (block.language === 'json' || block.language === 'text')
    && looksLikeRecoverableJsonToolPayload(block.code)
  );

  if (codeBlocks.length === 1 && jsonBlocks.length === 1) {
    const recovered = parseRecoveredPayload(
      jsonBlocks[0].code,
      stripCodeBlocksFromMessage(displayContent)
    );
    if (recovered) {
      return recovered;
    }
  }

  const trimmedDisplayContent = displayContent.trim();
  if (codeBlocks.length === 0 && looksLikeRecoverableJsonToolPayload(trimmedDisplayContent)) {
    return parseRecoveredPayload(trimmedDisplayContent, '');
  }

  return null;
}

function decodeToolMarkupValue(input: string) {
  return input
    .replace(/\\\\/g, '\0')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\0/g, '\\')
    .trim();
}

function parseToolMarkupTags(rawValue: string) {
  const trimmed = decodeToolMarkupValue(rawValue);
  if (!trimmed) return undefined;

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : undefined;
    } catch {
      // Fall back to plain-text splitting below.
    }
  }

  const items = trimmed
    .split(/[\n,，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function stripRecoveredToolMarkup(content: string) {
  return normalizeReplySpacing(
    content
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '\n\n')
      .replace(/<function=[^>]+>[\s\S]*?<\/function>/gi, '\n\n')
  );
}

function splitAssistantToolCallTranscript(content: string) {
  const match = ASSISTANT_TOOL_CALL_TRANSCRIPT_MARKER.exec(content);
  if (!match) return null;

  const transcriptStart = match.index;
  const payloadStart = transcriptStart + match[0].length;
  return {
    displayContent: normalizeReplySpacing(content.slice(0, transcriptStart)),
    rawPayload: content.slice(payloadStart).trim()
  };
}

function normalizeTranscriptToolPayloadItem(item: unknown) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const candidate = item as {
    kind?: unknown;
    name?: unknown;
    arguments?: unknown;
    args?: unknown;
  };
  const kind = typeof candidate.kind === 'string'
    ? candidate.kind
    : typeof candidate.name === 'string'
      ? candidate.name
      : null;
  if (!kind) return null;

  let parsedArguments: unknown = undefined;
  if (typeof candidate.arguments === 'string' && candidate.arguments.trim()) {
    parsedArguments = parseToolPayload(candidate.arguments);
  } else if (candidate.arguments && typeof candidate.arguments === 'object' && !Array.isArray(candidate.arguments)) {
    parsedArguments = candidate.arguments;
  } else if (candidate.args && typeof candidate.args === 'object' && !Array.isArray(candidate.args)) {
    parsedArguments = candidate.args;
  }

  return {
    kind,
    ...(parsedArguments && typeof parsedArguments === 'object' && !Array.isArray(parsedArguments) ? parsedArguments : {})
  };
}

export function recoverTranscriptToolCallActions(
  displayContent: string,
  themeToolMode: ThemeToolMode,
  parseContext?: AssistantToolActionParseContext
) {
  const transcript = splitAssistantToolCallTranscript(displayContent);
  if (!transcript) return null;

  if (!transcript.rawPayload) {
    return {
      displayContent: transcript.displayContent,
      actions: [],
      issues: ['助手回复里带了空的工具调用转录。']
    };
  }

  try {
    const parsedPayload = parseToolPayload(transcript.rawPayload);
    const payloadItems = Array.isArray(parsedPayload) ? parsedPayload : [parsedPayload];
    const actions: AssistantToolAction[] = [];
    const issues: string[] = [];

    for (const item of payloadItems) {
      const normalizedItem = normalizeTranscriptToolPayloadItem(item);
      if (!normalizedItem) continue;
      const result = parseAssistantToolAction(normalizedItem, transcript.displayContent, themeToolMode, parseContext);
      if (result.action) {
        actions.push(result.action);
      } else if (result.issue) {
        issues.push(result.issue);
      }
    }

    if (actions.length === 0 && issues.length === 0) {
      issues.push('助手回复里的工具调用转录没有恢复出可执行动作。');
    }

    return {
      displayContent: transcript.displayContent,
      actions,
      issues: Array.from(new Set(issues))
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知解析错误';
    return {
      displayContent: transcript.displayContent,
      actions: [],
      issues: [`助手回复里的工具调用转录解析失败：${errorMessage}`]
    };
  }
}

export function recoverTextualToolCallActions(
  displayContent: string,
  themeToolMode: ThemeToolMode,
  parseContext?: AssistantToolActionParseContext
) {
  const functionBlocks = Array.from(
    displayContent.matchAll(/<function=([a-zA-Z0-9_-]+)>\s*([\s\S]*?)<\/function>/gi)
  );

  if (functionBlocks.length === 0) {
    return null;
  }

  const actions: AssistantToolAction[] = [];
  const issues: string[] = [];
  const nextDisplayContent = stripRecoveredToolMarkup(displayContent);

  for (const block of functionBlocks) {
    const kind = block[1]?.trim();
    const body = block[2] ?? '';
    if (!kind) continue;

    const rawAction: Record<string, unknown> = { kind };
    const parameterMatches = Array.from(
      body.matchAll(
        /<parameter=([a-zA-Z0-9_-]+)>\s*([\s\S]*?)(?=<\/parameter>|<parameter=|<\/function>|<\/tool_call>|$)/gi
      )
    );

    for (const parameter of parameterMatches) {
      const key = parameter[1]?.trim();
      const rawValue = parameter[2] ?? '';
      if (!key) continue;
      if (key === 'tags') {
        rawAction[key] = parseToolMarkupTags(rawValue);
        continue;
      }
      rawAction[key] = decodeToolMarkupValue(rawValue);
    }

    const result = parseAssistantToolAction(rawAction, nextDisplayContent, themeToolMode, parseContext);
    if (result.action) {
      actions.push(result.action);
    } else if (result.issue) {
      issues.push(result.issue);
    }
  }

  if (actions.length === 0 && issues.length === 0) {
    return null;
  }

  return {
    displayContent: nextDisplayContent,
    actions,
    issues: Array.from(new Set(issues))
  };
}
