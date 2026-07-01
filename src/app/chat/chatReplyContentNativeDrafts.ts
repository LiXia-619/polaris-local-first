import type { AssistantNativeToolCall } from '../../engines/chatApi';
import { parseNativeToolPayload } from '../../engines/tool-protocol/assistantToolProtocolParser';

type ToolActionCodeItem = {
  language?: string;
  code: string;
};

function decodeDraftString(input: string) {
  return input
    .replace(/\\\\/g, '\0')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\0/g, '\\')
    .trim();
}

function extractDraftField(input: string, field: string) {
  const match = new RegExp(`"${field}"\\s*:\\s*"`, 'i').exec(input);
  if (!match) return null;

  let value = '';
  let escaped = false;
  for (let index = match.index + match[0].length; index < input.length; index += 1) {
    const character = input[index];
    if (escaped) {
      value += `\\${character}`;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '"') {
      return decodeDraftString(value);
    }
    value += character;
  }

  return decodeDraftString(value);
}

function extractDraftNumberField(input: string, field: string) {
  const match = new RegExp(`"${field}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'i').exec(input);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractDraftStringArrayField(input: string, field: string) {
  const match = new RegExp(`"${field}"\\s*:\\s*(\\[[\\s\\S]*?\\])`, 'i').exec(input);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return null;
    const items = parsed.filter((value): value is string => typeof value === 'string');
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function buildThemeToolDraftCode(toolCall: AssistantNativeToolCall) {
  const name = toolCall.name.trim();
  if (name === 'applyThemeCoordinates') {
    const draft: Record<string, string | number | string[]> = {
      kind: 'applyThemeCoordinates'
    };
    const targets = extractDraftField(toolCall.argumentsText, 'targets');
    const targetList = extractDraftStringArrayField(toolCall.argumentsText, 'targets');
    if (targets) draft.targets = targets;
    else if (targetList) draft.targets = targetList;

    const orderedNumberFields = ['hue', 'hueCount', 'emotion', 'meaning', 'seed'] as const;
    for (const field of orderedNumberFields) {
      const value = extractDraftNumberField(toolCall.argumentsText, field);
      if (value !== null) draft[field] = value;
    }

    const baseColor = extractDraftField(toolCall.argumentsText, 'baseColor');
    if (baseColor) draft.baseColor = baseColor;
    const label = extractDraftField(toolCall.argumentsText, 'label');
    if (label) draft.label = label;

    return Object.keys(draft).length > 1
      ? {
          language: 'json',
          code: JSON.stringify(draft, null, 2)
        }
      : null;
  }

  if (name === 'applySurfaceTokens') {
    const draft: Record<string, string | number | string[]> = {
      kind: 'applySurfaceTokens'
    };
    const targets = extractDraftStringArrayField(toolCall.argumentsText, 'targets');
    if (targets) draft.targets = targets;

    const orderedStringFields = [
      'surface',
      'spell',
      'texture',
      'gradientMode',
      'label'
    ] as const;
    for (const field of orderedStringFields) {
      const value = extractDraftField(toolCall.argumentsText, field);
      if (value) draft[field] = value;
    }

    const orderedNumberFields = [
      'hue',
      'saturation',
      'lightness',
      'opacity',
      'radius',
      'borderW',
      'blur',
      'shadowDepth',
      'gradientAngle',
      'accentHue'
    ] as const;
    for (const field of orderedNumberFields) {
      const value = extractDraftNumberField(toolCall.argumentsText, field);
      if (value !== null) draft[field] = value;
    }

    return Object.keys(draft).length > 1
      ? {
          language: 'json',
          code: JSON.stringify(draft, null, 2)
        }
      : null;
  }

  return null;
}

function extractRunCodeDraft(input: string) {
  try {
    const payload = parseNativeToolPayload('runCode', input);
    const code = typeof payload.code === 'string' ? payload.code.trim() : '';
    if (code) return code;
  } catch {
    // Draft projection is best-effort; final parsing reports the real tool error.
  }

  return extractDraftField(input, 'code');
}

export function collectNativeToolCallVisibleCode(nativeToolCalls: AssistantNativeToolCall[]) {
  const items: ToolActionCodeItem[] = [];

  for (const toolCall of nativeToolCalls) {
    const name = toolCall.name.trim();
    if (!name) continue;

    if (
      name === 'createCodeCard'
      || name === 'createProjectFile'
      || name === 'patchCodeCard'
      || name === 'appendCodeCard'
      || name === 'appendProjectFile'
      || name === 'insertProjectFile'
      || name === 'replaceProjectFileLines'
      || name === 'editCodeCardText'
      || name === 'editProjectFileText'
      || name === 'saveAttachmentAsCodeCard'
      || name === 'saveArchiveEntryAsCodeCard'
      || name === 'runCode'
    ) {
      const code =
        name === 'runCode'
          ? extractRunCodeDraft(toolCall.argumentsText)
          : name === 'editCodeCardText' || name === 'editProjectFileText'
            ? extractDraftField(toolCall.argumentsText, 'newString')
            : extractDraftField(toolCall.argumentsText, 'code');
      if (!code) continue;
      items.push({
        language:
          name === 'runCode'
            ? 'js'
            : extractDraftField(toolCall.argumentsText, 'language') ?? undefined,
        code
      });
    }
  }

  return items;
}

export function collectNativeToolCallToolDraftCode(nativeToolCalls: AssistantNativeToolCall[]) {
  const items: ToolActionCodeItem[] = [];

  for (const toolCall of nativeToolCalls) {
    const name = toolCall.name.trim();
    if (!name) continue;

    if (name === 'patchRawCss' || name === 'appendThemeCss' || name === 'insertThemeCss') {
      const css = extractDraftField(toolCall.argumentsText, 'css');
      if (css) {
        items.push({ language: 'css', code: css });
      }
      continue;
    }
    if (name === 'deleteThemeCss') {
      const css = extractDraftField(toolCall.argumentsText, 'oldString');
      if (css) {
        items.push({ language: 'css', code: css });
      }
      continue;
    }

    if (name === 'applyThemeCoordinates' || name === 'applySurfaceTokens') {
      const draft = buildThemeToolDraftCode(toolCall);
      if (draft) {
        items.push(draft);
      }
    }
  }

  return items;
}
