import { recordAppRuntimeLogEntry } from '../../infrastructure/appRuntimeLog';

type ChatSendTrace = {
  id: string;
  conversationId: string;
  startedAt: number;
  lastAt: number;
};

type ChatSendTraceDetail = {
  conversationCount?: number;
  messageCount?: number;
  attachmentCount?: number;
  hasCardReference?: boolean;
  elapsedMs?: number;
  totalElapsedMs?: number;
  extra?: Array<string | null | undefined | false>;
};

const activeTraces = new Map<string, ChatSendTrace>();

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function createTraceId() {
  return `send-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function roundMs(value: number) {
  return Math.max(0, Math.round(value));
}

function compactParts(parts: Array<string | null | undefined | false>) {
  return parts.filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(' · ');
}

function formatDetail(trace: ChatSendTrace, detail: ChatSendTraceDetail = {}) {
  const elapsedSinceLast = detail.elapsedMs ?? nowMs() - trace.lastAt;
  const totalElapsed = detail.totalElapsedMs ?? nowMs() - trace.startedAt;

  return compactParts([
    `trace ${trace.id}`,
    `+${roundMs(elapsedSinceLast)} ms`,
    `total ${roundMs(totalElapsed)} ms`,
    typeof detail.conversationCount === 'number' ? `conversations ${detail.conversationCount}` : null,
    typeof detail.messageCount === 'number' ? `messages ${detail.messageCount}` : null,
    typeof detail.attachmentCount === 'number' ? `attachments ${detail.attachmentCount}` : null,
    typeof detail.hasCardReference === 'boolean' ? `card ${detail.hasCardReference ? 'yes' : 'no'}` : null,
    ...(detail.extra ?? [])
  ]);
}

export function startChatSendPerformanceTrace(conversationId: string, detail: ChatSendTraceDetail = {}) {
  const now = nowMs();
  const trace: ChatSendTrace = {
    id: createTraceId(),
    conversationId,
    startedAt: now,
    lastAt: now
  };
  activeTraces.set(conversationId, trace);
  recordAppRuntimeLogEntry({
    at: Date.now(),
    kind: 'chat-send-performance',
    title: '聊天发送 · 开始',
    detail: formatDetail(trace, {
      ...detail,
      elapsedMs: 0,
      totalElapsedMs: 0
    })
  });
  return trace.id;
}

export function ensureChatSendPerformanceTrace(conversationId: string, detail: ChatSendTraceDetail = {}) {
  const existing = activeTraces.get(conversationId);
  if (existing) return existing.id;
  return startChatSendPerformanceTrace(conversationId, detail);
}

export function recordChatSendPerformanceMark(
  conversationId: string,
  title: string,
  detail: ChatSendTraceDetail = {}
) {
  const trace = activeTraces.get(conversationId);
  if (!trace) return;
  const now = nowMs();
  recordAppRuntimeLogEntry({
    at: Date.now(),
    kind: 'chat-send-performance',
    title,
    detail: formatDetail(trace, {
      ...detail,
      elapsedMs: detail.elapsedMs ?? now - trace.lastAt,
      totalElapsedMs: detail.totalElapsedMs ?? now - trace.startedAt
    })
  });
  trace.lastAt = now;
}

export function finishChatSendPerformanceTrace(
  conversationId: string,
  status: 'completed' | 'aborted' | 'failed',
  detail: ChatSendTraceDetail = {}
) {
  const trace = activeTraces.get(conversationId);
  if (!trace) return;
  const statusLabel = status === 'completed' ? '完成' : status === 'aborted' ? '中止' : '失败';
  recordChatSendPerformanceMark(conversationId, `聊天发送 · ${statusLabel}`, detail);
  activeTraces.delete(conversationId);
}
