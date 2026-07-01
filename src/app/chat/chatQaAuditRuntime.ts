import { isChatQaAuditCaptureEnabled } from '../developer/debugCaptureRuntime';
import { createDebugLog } from '../../infrastructure/debugLog';
import type { AssistantReply } from '../../engines/chatApi';
import type { ToolAction } from '../../engines/toolExecutor';
import type { ChatMessage } from '../../types/domain';
import type { AssistantToolPreparationOutcome, ToolActionRunOutcome } from './chatToolOutcome';

export type ChatQaAuditEntry = {
  at: number;
  conversationId: string;
  collaboratorId: string;
  assistantName: string;
  modelId: string | null;
  finishReason: string | null;
  phase: 'completed' | 'tooling_blocked' | 'request_failed' | 'aborted';
  toolPreparationStatus: AssistantToolPreparationOutcome['status'] | 'request_failed' | 'aborted';
  userIntent: string;
  visibleReply: string;
  toolCallMode: 'none' | 'declared' | 'executed';
  usedNativeToolCalls: boolean;
  nativeToolCallCount: number;
  declaredActionKinds: string[];
  resolvedActionKinds: ToolAction['kind'][];
  executedOutcomes: Array<{
    path: ToolActionRunOutcome['path'];
    kind: ToolAction['kind'];
    status: string;
    title: string;
    targetLabel: string | null;
    summary: string | null;
    error: string | null;
  }>;
  verdict: 'pass' | 'warn' | 'fail';
  reasons: string[];
};

export type ChatQaAuditSummary = {
  total: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  latestFailures: Array<{
    at: number;
    assistantName: string;
    verdict: 'warn' | 'fail';
    reasons: string[];
    userIntent: string;
  }>;
};

type ChatQaDraftEntry = Omit<ChatQaAuditEntry, 'verdict' | 'reasons'>;

const CHAT_QA_AUDIT_STORAGE_KEY = 'polaris-chat-qa-audit-log';
const CHAT_QA_AUDIT_LIMIT = 40;

const chatQaAuditLog = createDebugLog<ChatQaAuditEntry>(CHAT_QA_AUDIT_STORAGE_KEY, {
  maxEntries: CHAT_QA_AUDIT_LIMIT
});

function getLatestUserIntent(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'user' && !message.toolInvocation && message.content.trim())
    ?.content
    ?.trim()
    ?? '';
}

function truncate(text: string | undefined, maxLength = 140) {
  const value = text?.trim() ?? '';
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function simplifyOutcome(outcome: ToolActionRunOutcome) {
  if (outcome.path === 'direct') {
    return {
      path: outcome.path,
      kind: outcome.action.kind,
      status: outcome.status,
      title: outcome.toolInvocation.title,
      targetLabel: outcome.toolInvocation.targetLabel ?? null,
      summary: truncate(outcome.toolInvocation.summary),
      error: outcome.error ?? outcome.toolInvocation.error ?? null
    };
  }

  return {
    path: outcome.path,
    kind: outcome.action.kind,
    status: outcome.status,
    title: outcome.action.kind,
    targetLabel: 'targetLabel' in outcome.action && typeof outcome.action.targetLabel === 'string'
      ? outcome.action.targetLabel
      : null,
    summary: null,
    error: 'error' in outcome ? outcome.error ?? null : null
  };
}

function buildVerdict(entry: ChatQaDraftEntry): Pick<ChatQaAuditEntry, 'verdict' | 'reasons'> {
  const reasons: string[] = [];

  if (entry.phase === 'request_failed') {
    reasons.push('请求本身失败了，这轮还没到工具验证。');
    return { verdict: 'fail' as const, reasons };
  }

  if (entry.phase === 'aborted') {
    reasons.push('这轮被中途停止，结果不算稳定通过。');
    return { verdict: 'warn' as const, reasons };
  }

  if (entry.toolPreparationStatus === 'parse_failed') {
    reasons.push('模型回了工具格式，但解析没过。');
  }
  if (entry.toolPreparationStatus === 'resolution_failed') {
    reasons.push('模型想调用工具，但目标解析失败。');
  }
  if (entry.toolPreparationStatus === 'missing_actions') {
    reasons.push('这轮应该带工具动作，但最后没有形成可执行动作。');
  }

  const failedExecutions = entry.executedOutcomes.filter((outcome) => outcome.status === 'failed');
  if (failedExecutions.length > 0) {
    reasons.push(`有 ${failedExecutions.length} 个工具执行失败。`);
  }

  if (entry.declaredActionKinds.length > 0 && entry.executedOutcomes.length === 0 && entry.toolPreparationStatus === 'ready') {
    reasons.push('模型声明了动作，但没有留下执行结果。');
  }

  if (reasons.length > 0) {
    return {
      verdict: failedExecutions.length > 0 || entry.toolPreparationStatus === 'parse_failed'
        ? 'fail' as const
        : 'warn' as const,
      reasons
    };
  }

  return {
    verdict: 'pass' as const,
    reasons: entry.executedOutcomes.length > 0
      ? ['这轮工具链从声明到执行都落到了可见结果。']
      : ['这轮不需要工具，回复链路正常。']
  };
}

export function readChatQaAuditEntries() {
  return chatQaAuditLog.read();
}

export function clearChatQaAuditEntries() {
  chatQaAuditLog.clear();
}

export function summarizeChatQaAuditEntries(entries = chatQaAuditLog.read()): ChatQaAuditSummary {
  const passCount = entries.filter((entry) => entry.verdict === 'pass').length;
  const warnCount = entries.filter((entry) => entry.verdict === 'warn').length;
  const failCount = entries.filter((entry) => entry.verdict === 'fail').length;

  return {
    total: entries.length,
    passCount,
    warnCount,
    failCount,
    latestFailures: [...entries]
      .reverse()
      .filter((entry): entry is ChatQaAuditEntry & { verdict: 'warn' | 'fail' } => entry.verdict !== 'pass')
      .slice(0, 8)
      .map((entry) => ({
        at: entry.at,
        assistantName: entry.assistantName,
        verdict: entry.verdict,
        reasons: entry.reasons,
        userIntent: entry.userIntent
      }))
  };
}

export type ChatQaAuditRecordArgs = {
  phase: ChatQaAuditEntry['phase'];
  toolPreparationStatus: ChatQaAuditEntry['toolPreparationStatus'];
  conversationId: string;
  collaboratorId: string;
  assistantName: string;
  messages: ChatMessage[];
  visibleReply?: string;
  reply?: AssistantReply;
  preparationOutcome?: AssistantToolPreparationOutcome;
  resolvedActions?: ToolAction[];
  outcomes?: ToolActionRunOutcome[];
};

export function recordChatQaAuditEntry(args: ChatQaAuditRecordArgs) {
  if (!isChatQaAuditCaptureEnabled()) return;

  const declaredActionKinds = args.preparationOutcome?.parsed.actions.map((action) => action.kind) ?? [];
  const resolvedActionKinds = args.resolvedActions?.map((action) => action.kind) ?? [];
  const executedOutcomes = (args.outcomes ?? []).map(simplifyOutcome);
  const draftEntry: ChatQaDraftEntry = {
    at: Date.now(),
    conversationId: args.conversationId,
    collaboratorId: args.collaboratorId,
    assistantName: args.assistantName,
    modelId: args.reply?.model?.trim() || null,
    finishReason: args.reply?.finishReason?.trim() || null,
    phase: args.phase,
    toolPreparationStatus: args.toolPreparationStatus,
    userIntent: truncate(getLatestUserIntent(args.messages), 220),
    visibleReply: truncate(args.visibleReply, 220),
    toolCallMode: executedOutcomes.length > 0 ? 'executed' : declaredActionKinds.length > 0 ? 'declared' : 'none',
    usedNativeToolCalls: args.reply?.usedNativeToolCalls === true,
    nativeToolCallCount: args.reply?.nativeToolCallCount ?? 0,
    declaredActionKinds,
    resolvedActionKinds,
    executedOutcomes
  };
  const verdict = buildVerdict(draftEntry);
  chatQaAuditLog.append({ ...draftEntry, ...verdict });
}
