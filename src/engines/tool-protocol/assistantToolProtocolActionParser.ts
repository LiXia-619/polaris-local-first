import { canonicalizeAssistantToolValue } from './assistantToolProtocolCanonicalizer';
import type { ThemeToolMode } from '../../types/domain';
import { normalizeAssistantToolActionValue } from './assistantToolProtocolNormalizer';
import { asObject } from './assistantToolProtocolShared';
import { inferAssistantToolKind } from './assistantToolProtocolActionKind';
import { parseAttachmentToolAction } from './assistantToolProtocolActionAttachments';
import { parseContentToolAction } from './assistantToolProtocolActionContent';
import { parseThemeToolAction } from './assistantToolProtocolThemeParser';
import { parseMcpToolAction } from './assistantToolProtocolActionMcp';
import type { ParseActionResult } from './assistantToolProtocolActionShared';
import type { AssistantToolActionParseContext } from './assistantToolProtocolActionContext';

export type { ParseActionResult } from './assistantToolProtocolActionShared';

const ROOT_CODE_CARD_KIND_VALUES = new Set(['card', 'tool', 'room-rule']);

function withInferredRootKind(
  action: Record<string, unknown>,
  inferredKind: string
) {
  const rootKind = typeof action.kind === 'string' ? action.kind.trim() : '';
  const card = asObject(action.card);
  const preserveRootCardKind =
    ROOT_CODE_CARD_KIND_VALUES.has(rootKind)
    && inferredKind === 'createCodeCard'
    && typeof card?.kind !== 'string';

  return {
    ...action,
    kind: inferredKind,
    ...(preserveRootCardKind ? {
      card: {
        ...(card ?? {}),
        kind: rootKind
      }
    } : {})
  };
}

export function parseAssistantToolAction(
  value: unknown,
  contentHint?: string,
  themeToolMode: ThemeToolMode = 'stable',
  parseContext?: AssistantToolActionParseContext
): ParseActionResult {
  const canonicalValue = canonicalizeAssistantToolValue(value);
  const rawAction = asObject(canonicalValue);
  const rawKind = typeof rawAction?.kind === 'string' ? rawAction.kind.trim() : '';
  const shouldInferRootKind =
    rawAction
    && (
      typeof rawAction.kind !== 'string'
      || ROOT_CODE_CARD_KIND_VALUES.has(rawKind)
    );
  const valueWithFallbackKind =
    rawAction && shouldInferRootKind
      ? (() => {
          const inferredKind = inferAssistantToolKind(rawAction, themeToolMode);
          return inferredKind ? withInferredRootKind(rawAction, inferredKind) : canonicalValue;
        })()
      : canonicalValue;
  const normalizedValue = normalizeAssistantToolActionValue(valueWithFallbackKind);
  const action = asObject(normalizedValue);
  if (!action || typeof action.kind !== 'string') {
    return { action: null, issue: '工具动作缺少 kind，无法执行。' };
  }

  const themeResult = parseThemeToolAction(normalizedValue, contentHint, themeToolMode);
  if (themeResult) {
    return themeResult;
  }

  const contentResult = parseContentToolAction(action, parseContext);
  if (contentResult) {
    return contentResult;
  }

  const attachmentResult = parseAttachmentToolAction(action);
  if (attachmentResult) {
    return attachmentResult;
  }

  const mcpResult = parseMcpToolAction(action, parseContext);
  if (mcpResult) {
    return mcpResult;
  }

  return { action: null, issue: `未知工具动作：${action.kind}` };
}
