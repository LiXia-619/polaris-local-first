import { normalizeCodeLanguage } from './codeCardLanguage';
import { buildToolCardExecutionCode, parseToolCardExecutionEnvelope } from './toolCardRuntime';
import { isToolActionKindHandledByPlugin } from './tool-protocol/toolManifest';
import type { ToolExecutorPlugin } from './toolExecutorPlugins';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';

export type CodeCardToolAction = Extract<ToolAction, { kind: 'invokeCodeCardTool' }>;

export function isCodeCardToolAction(action: ToolAction): action is CodeCardToolAction {
  return isToolActionKindHandledByPlugin(action.kind, 'code-card');
}

function formatToolCardResult(value: unknown) {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function executeCodeCardToolAction(
  action: CodeCardToolAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  const card = ctx.readCodeCard(action.cardId);
  if (!card) {
    return { ok: false, error: '没有找到要调用的工具卡。' };
  }
  if (normalizeCodeLanguage(card.language) !== 'javascript') {
    return { ok: false, error: '工具卡目前只支持 JavaScript。' };
  }

  const roomState = await ctx.readCodeCardState(card.id);
  const result = await ctx.runCode(buildToolCardExecutionCode({
    card,
    payload: {
      input: action.input,
      args: action.args,
      targetLabel: action.targetLabel
    },
    roomState
  }));
  const logText = result.logs
    .map((entry) => `[${entry.level}] ${entry.args.join(' ')}`)
    .join('\n');

  if (!result.ok) {
    const errorDetail = [
      result.error,
      result.stack ? `\n${result.stack}` : '',
      logText ? `\n--- console ---\n${logText}` : ''
    ].filter(Boolean).join('');
    return {
      ok: false,
      error: errorDetail
    };
  }

  const envelope = parseToolCardExecutionEnvelope(result.returnValue);
  if (!envelope) {
    return {
      ok: false,
      error: '工具卡执行结束了，但没有返回有效结果。'
    };
  }

  ctx.writeCodeCardState(card.id, envelope.roomState);
  const detailParts = [
    envelope.resultProvided ? `返回值：${formatToolCardResult(envelope.result)}` : null,
    logText ? `--- console ---\n${logText}` : null
  ].filter(Boolean);
  return {
    ok: true,
    summary: `已调用工具卡 · ${card.title}`,
    detailText: detailParts.join('\n\n') || '（无输出）',
    cardId: card.id
  };
}

export const codeCardToolExecutorPlugin: ToolExecutorPlugin = {
  name: 'code-card',
  canHandle: isCodeCardToolAction,
  execute: async (action, ctx) => {
    if (!isCodeCardToolAction(action)) {
      return { ok: false, error: `工具卡执行器无法执行：${action.kind}` };
    }
    return executeCodeCardToolAction(action, ctx);
  }
};
