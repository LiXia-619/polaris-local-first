import type { AssistantReply } from '../../engines/chatApi';
import type { ToolAction } from '../../engines/toolExecutor';
import { createUid } from '../../engines/id';
import type { RuntimeFeedbackEvent } from '../../engines/runtime-feedback/runtimeFeedbackEvents';
import type { ToolInvocation } from '../../types/domain';
import { TOOL_INVOCATION_KINDS } from '../../types/toolInvocationKinds';
import { parseAssistantReplyContent } from './chatReplyContent';

export type AssistantToolPreparationOutcome =
  | {
      status: 'ready';
      reply: AssistantReply;
      parsed: ReturnType<typeof parseAssistantReplyContent>['parsed'];
      resolvedActions: ToolAction[];
    }
  | {
      status: 'missing_actions' | 'parse_failed' | 'resolution_failed';
      reply: AssistantReply;
      parsed: ReturnType<typeof parseAssistantReplyContent>['parsed'];
      resolvedActions: ToolAction[];
      truncated?: boolean;
      message: string;
    };

export type ToolActionRunOutcome =
  | {
      path: 'preview';
      status: 'previewed' | 'failed';
      action: ToolAction;
      error?: string;
    }
  | {
      path: 'workspace';
      status: 'pending';
      action: ToolAction;
      proposalId: string;
    }
  | {
      path: 'memory';
      status: 'handled';
      action: ToolAction;
    }
  | {
      path: 'direct';
      status: 'executed' | 'failed';
      action: ToolAction;
      toolInvocation: ToolInvocation;
      projectPreviewRunnable?: boolean;
      error?: string;
    };

function looksLikeUnfinishedStructuredPayload(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return false;

  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let quoteChar = '';
  let escaped = false;

  for (const char of trimmed) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quoteChar) {
        inString = false;
        quoteChar = '';
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      quoteChar = char;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
    }
  }

  return inString || braceDepth > 0 || bracketDepth > 0 || /[:,]\s*$/.test(trimmed);
}

function hasUnclosedToolFence(content: string) {
  const trimmed = content.trim();
  if (!trimmed.includes('```polaris-tools')) return false;
  return ((trimmed.match(/```/g) ?? []).length % 2) === 1;
}

function looksLikeTruncatedToolOutput(args: {
  reply: AssistantReply;
  parsed: ReturnType<typeof parseAssistantReplyContent>['parsed'];
}) {
  if (args.reply.finishReason === 'length') {
    return true;
  }

  const issueText = args.parsed.issues.join('\n').toLowerCase();
  if (
    issueText.includes('unexpected end of json input')
    || issueText.includes('unterminated string')
    || issueText.includes('unexpected end of data')
  ) {
    return true;
  }

  if ((args.reply.nativeToolCalls ?? []).some((toolCall) => looksLikeUnfinishedStructuredPayload(toolCall.argumentsText))) {
    return true;
  }

  return hasUnclosedToolFence(args.reply.content);
}

function sanitizeToolPreparationReason(line: string) {
  if (/^原始(?:片段|参数)：/u.test(line)) {
    return '原始工具参数已从下一轮上下文省略。';
  }
  return line;
}

function compactToolPreparationReasons(lines: string[]) {
  const seen = new Set<string>();
  return lines
    .flatMap((line) => line.split('\n'))
    .map((line) => sanitizeToolPreparationReason(line.trim()))
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .slice(0, 4);
}

export function resolveAssistantToolPreparationOutcome(args: {
  reply: AssistantReply;
  parsed: ReturnType<typeof parseAssistantReplyContent>['parsed'];
  resolvedActions: ToolAction[];
  resolutionErrors: string[];
  expectsToolAction: boolean;
}): AssistantToolPreparationOutcome {
  if (args.resolutionErrors.length > 0) {
    return {
      status: 'resolution_failed',
      reply: args.reply,
      parsed: args.parsed,
      resolvedActions: args.resolvedActions,
      message: args.resolutionErrors.join('\n')
    };
  }

  if (args.parsed.issues.length > 0) {
    const truncated = looksLikeTruncatedToolOutput(args);
    const message = truncated
      ? '模型确实已经开始生成了，但工具动作写到尾巴时断掉了，最后一段没有完整传回来。更像是 provider 提前收口，或者输出在末尾被截断，不是单纯没去执行。你可以让 AI 先分块落工具，再补正文。'
      : args.parsed.issues.join('\n');
    return {
      status: 'parse_failed',
      reply: args.reply,
      parsed: args.parsed,
      resolvedActions: args.resolvedActions,
      truncated,
      message
    };
  }

  // A shallow regex must not decide whether a reply is allowed to stand.
  // Tool enforcement is now based on actual parsed / resolved actions only.

  if (args.resolvedActions.length === 0) {
    if (!args.expectsToolAction) {
      return {
        status: 'ready',
        reply: args.reply,
        parsed: args.parsed,
        resolvedActions: args.resolvedActions
      };
    }
    return {
      status: 'missing_actions',
      reply: args.reply,
      parsed: args.parsed,
      resolvedActions: args.resolvedActions,
      message: '这次回复没有形成可执行的工具动作，所以内容还没有真正落到 Polaris。'
    };
  }

  return {
    status: 'ready',
    reply: args.reply,
    parsed: args.parsed,
    resolvedActions: args.resolvedActions
  };
}

export function buildPreparationFailureRuntimeFeedbackEvent(
  outcome: AssistantToolPreparationOutcome,
  createdAt = Date.now()
): RuntimeFeedbackEvent | null {
  if (outcome.status === 'ready') return null;

  const reasons = (
    outcome.status === 'resolution_failed'
      ? outcome.message.split('\n')
      : outcome.parsed.issues
  );
  const compactReasons = compactToolPreparationReasons(reasons);

  return {
    id: createUid('rtf'),
    kind: 'assistant_tool_preparation_failed',
    createdAt,
    status: outcome.status,
    summary:
      outcome.status === 'missing_actions'
        ? '上一轮工具准备失败，没有形成可执行动作。'
        : outcome.status === 'resolution_failed'
          ? '上一轮工具准备失败，动作解析没有落成。'
          : outcome.truncated
            ? '上一轮工具准备失败，输出在尾部截断了。'
            : '上一轮工具准备失败，工具块没有通过解析。',
    truncated: outcome.truncated,
    reasons: compactReasons.length > 0 ? compactReasons : undefined,
    declaredActionKinds: outcome.parsed.actions.map((action) => action.kind),
    resolvedActionKinds: outcome.resolvedActions.map((action) => action.kind)
  };
}

function isToolInvocationKind(value: string): value is ToolInvocation['kind'] {
  return (TOOL_INVOCATION_KINDS as readonly string[]).includes(value);
}

function resolvePreparationFailureToolKind(outcome: Exclude<AssistantToolPreparationOutcome, { status: 'ready' }>) {
  const parsedKind = outcome.parsed.actions[0]?.kind;
  if (parsedKind && isToolInvocationKind(parsedKind)) return parsedKind;

  const nativeToolName = outcome.reply.nativeToolCalls?.[0]?.name;
  if (nativeToolName && isToolInvocationKind(nativeToolName)) return nativeToolName;

  const issueText = [
    outcome.message,
    ...outcome.parsed.issues,
    ...(outcome.reply.nativeToolCalls ?? []).map((toolCall) => toolCall.name)
  ].join('\n');
  if (/polaris-project-file|工作区文件|project\s*file|writeProjectFiles/i.test(issueText)) {
    return 'writeProjectFiles';
  }

  return 'startTask';
}

export function buildPreparationFailureToolInvocation(
  outcome: AssistantToolPreparationOutcome
): ToolInvocation | null {
  if (outcome.status === 'ready') return null;

  const feedbackEvent = buildPreparationFailureRuntimeFeedbackEvent(outcome);
  const reasonLines = (
    outcome.status === 'resolution_failed'
      ? outcome.message.split('\n')
      : outcome.parsed.issues.length > 0
        ? outcome.parsed.issues
        : [outcome.message]
  );
  const reasonText = compactToolPreparationReasons(reasonLines).join('\n');
  const summary = feedbackEvent?.summary ?? '工具准备失败。';

  return {
    id: createUid('tool'),
    kind: resolvePreparationFailureToolKind(outcome),
    status: 'failed',
    title: '工具准备失败',
    summary,
    detailText: reasonText || outcome.message,
    error: reasonText || outcome.message
  };
}

export function buildInterruptedWorkspaceDraftFailureToolInvocation(error?: unknown): ToolInvocation {
  const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const fallback = '这段回复里出现了工作区文件草稿，但流式连接先断了，Polaris 没有拿到可执行的完整写入动作。';
  const detailText = errorMessage || fallback;

  return {
    id: createUid('tool'),
    kind: 'writeProjectFiles',
    status: 'failed',
    title: '工作区草稿未落地',
    summary: '流式连接中断，工作区草稿没有完成写入。',
    detailText,
    error: detailText
  };
}
