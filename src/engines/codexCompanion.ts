import { createMessage } from './chatMessageFactory';
import type { ChatMessage, PolarisCompanionSnapshot } from '../types/domain';

export type CodexUserInput =
  | { type: 'text'; text: string; text_elements?: unknown[] }
  | { type: 'image'; url: string }
  | { type: 'localImage'; path: string }
  | { type: 'skill'; name: string; path: string }
  | { type: 'mention'; name: string; path: string };

export type CodexThreadItem =
  | { type: 'userMessage'; id: string; content: CodexUserInput[] }
  | { type: 'agentMessage'; id: string; text: string; phase: 'commentary' | 'final_answer' | null; memoryCitation?: unknown }
  | { type: 'commandExecution'; id: string; command: string; status: string; aggregatedOutput: string | null; exitCode: number | null }
  | { type: 'fileChange'; id: string; changes: Array<unknown>; status: string }
  | { type: 'mcpToolCall'; id: string; server: string; tool: string; status: string; error: { message?: string | null } | null }
  | { type: 'dynamicToolCall'; id: string; tool: string; status: string; success: boolean | null }
  | { type: 'plan'; id: string; text: string }
  | { type: 'reasoning'; id: string; summary: string[]; content: string[] }
  | { type: string; id: string };

export type CodexTurn = {
  id: string;
  status: 'completed' | 'interrupted' | 'failed' | 'inProgress';
  items: CodexThreadItem[];
};

export type CodexThread = {
  id: string;
  name: string | null;
  preview: string;
  updatedAt: number;
  status: string | { type?: string | null; activeFlags?: string[] };
  cwd: string;
  turns: CodexTurn[];
};

export type CodexCompanionPendingCommand = {
  id: string;
  text: string;
  createdAt: number;
  userMessageCountBase: number | null;
};

function readCodexThreadStatusType(status: CodexThread['status']) {
  return typeof status === 'string'
    ? status
    : status?.type ?? '';
}

function readCodexThreadActiveFlags(status: CodexThread['status']) {
  if (!status || typeof status === 'string' || !('activeFlags' in status)) {
    return [];
  }
  return Array.isArray(status.activeFlags)
    ? status.activeFlags.filter((flag): flag is string => typeof flag === 'string' && flag.trim().length > 0)
    : [];
}

export function isCodexThreadStatusBusy(status: CodexThread['status']) {
  const statusType = readCodexThreadStatusType(status);
  if (statusType === 'inProgress') {
    return true;
  }
  return readCodexThreadActiveFlags(status).length > 0;
}

export function isCodexThreadBusy(thread: CodexThread) {
  if (thread.turns.some((turn) => turn.status === 'inProgress')) {
    return true;
  }
  return isCodexThreadStatusBusy(thread.status);
}

export function isCodexThreadLoaded(thread: CodexThread) {
  return readCodexThreadStatusType(thread.status) !== 'notLoaded';
}

export function isCodexThreadReadDeferredError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes('includeTurns is unavailable before first user message')
    || message.includes('is not materialized yet')
  );
}

function normalizeCodexCompanionMessageContent(content: string) {
  return content.trim();
}

function isCodexUserMessage(
  item: CodexThreadItem
): item is Extract<CodexThreadItem, { type: 'userMessage' }> {
  return item.type === 'userMessage' && 'content' in item;
}

function isCodexAgentMessage(
  item: CodexThreadItem
): item is Extract<CodexThreadItem, { type: 'agentMessage' }> {
  return item.type === 'agentMessage' && 'text' in item;
}

function stripCodexAppDirectives(text: string) {
  return text
    .split('\n')
    .filter((line) => !/^\s*::[a-z-]+\{.*\}\s*$/iu.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isIgnorableCodexAssistantFragment(text: string, phase: 'commentary' | 'final_answer' | null) {
  if (phase === 'final_answer') return false;
  const trimmed = text.trim();
  if (!trimmed) return true;
  return trimmed.length <= 4 && /^[\p{P}\p{S}\s]+$/u.test(trimmed);
}

function isCodexToolItem(
  item: CodexThreadItem
): item is Extract<CodexThreadItem, { type: 'commandExecution' | 'fileChange' | 'mcpToolCall' | 'dynamicToolCall' }> {
  return (
    (item.type === 'commandExecution' && 'command' in item)
    || (item.type === 'fileChange' && 'changes' in item)
    || (item.type === 'mcpToolCall' && 'tool' in item && 'server' in item)
    || (item.type === 'dynamicToolCall' && 'tool' in item)
  );
}

function summarizeCodexUserInput(input: CodexUserInput) {
  switch (input.type) {
    case 'text':
      return input.text.trim();
    case 'image':
      return `[图片] ${input.url}`;
    case 'localImage':
      return `[本地图片] ${input.path}`;
    case 'skill':
      return `[技能] ${input.name}`;
    case 'mention':
      return `[提及] ${input.name}`;
    default:
      return '';
  }
}

function summarizeCodexToolItem(item: Extract<CodexThreadItem, { type: 'commandExecution' | 'fileChange' | 'mcpToolCall' | 'dynamicToolCall' }>) {
  switch (item.type) {
    case 'commandExecution': {
      const state = item.status === 'completed'
        ? item.exitCode === 0 ? '已完成' : `失败(${item.exitCode ?? '?'})`
        : item.status === 'in_progress' ? '执行中' : item.status;
      return `命令 ${state}：${item.command}`;
    }
    case 'fileChange':
      return `文件改动 ${item.status}：${item.changes.length} 项`;
    case 'mcpToolCall':
      return item.error?.message
        ? `MCP ${item.server}/${item.tool} ${item.status}：${item.error.message}`
        : `MCP ${item.server}/${item.tool} ${item.status}`;
    case 'dynamicToolCall':
      return `工具 ${item.tool} ${item.status}`;
  }
}

function collectCodexUserMessageContents(thread: CodexThread) {
  const contents: string[] = [];
  for (const turn of thread.turns) {
    for (const item of turn.items) {
      if (!isCodexUserMessage(item)) continue;
      const text = item.content
        .map((entry: CodexUserInput) => summarizeCodexUserInput(entry))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (text) {
        contents.push(normalizeCodexCompanionMessageContent(text));
      }
    }
  }
  return contents;
}

export function countCodexUserMessages(thread: CodexThread) {
  return collectCodexUserMessageContents(thread).length;
}

export function reconcileCodexPendingCommands(
  thread: CodexThread,
  pendingCommands: CodexCompanionPendingCommand[]
) {
  if (pendingCommands.length === 0) return pendingCommands;

  const remoteUserContents = collectCodexUserMessageContents(thread);
  let nextSearchIndex = 0;

  return pendingCommands.filter((command) => {
    if (command.userMessageCountBase === null) {
      return true;
    }
    const normalizedText = normalizeCodexCompanionMessageContent(command.text);
    if (!normalizedText) {
      return false;
    }
    const searchFrom = Math.max(command.userMessageCountBase, nextSearchIndex);
    for (let index = searchFrom; index < remoteUserContents.length; index += 1) {
      if (remoteUserContents[index] !== normalizedText) {
        continue;
      }
      nextSearchIndex = index + 1;
      return false;
    }
    return true;
  });
}

function buildPendingCodexMessages(pendingCommands: CodexCompanionPendingCommand[]) {
  return pendingCommands
    .map((command) => {
      const text = command.text.trim();
      if (!text) return null;
      const message = createMessage('user', text, undefined, 'user-input', command.id);
      message.timestamp = command.createdAt;
      return message;
    })
    .filter((message): message is ChatMessage => Boolean(message));
}

function buildCodexMessages(thread: CodexThread) {
  const messages: ChatMessage[] = [];
  const baseTimestamp = thread.updatedAt * 1000;
  let cursor = 0;

  for (const turn of thread.turns) {
    for (const item of turn.items) {
      if (isCodexUserMessage(item)) {
        const text = item.content
          .map((entry: CodexUserInput) => summarizeCodexUserInput(entry))
          .filter(Boolean)
          .join('\n')
          .trim();
        if (!text) continue;
        const message = createMessage('user', text, undefined, 'user-input', item.id);
        message.timestamp = baseTimestamp + cursor;
        messages.push(message);
        cursor += 1;
        continue;
      }

      if (isCodexAgentMessage(item)) {
        const text = stripCodexAppDirectives(item.text);
        if (!text || isIgnorableCodexAssistantFragment(text, item.phase)) continue;
        const message = createMessage('assistant', text, undefined, 'assistant-reply', item.id);
        message.timestamp = baseTimestamp + cursor;
        message.assistantName = 'Codex';
        messages.push(message);
        cursor += 1;
        continue;
      }

      if (isCodexToolItem(item)) {
        const message = createMessage('system', summarizeCodexToolItem(item), undefined, 'tool-runtime', item.id);
        message.timestamp = baseTimestamp + cursor;
        messages.push(message);
        cursor += 1;
      }
    }
  }

  return messages;
}

export function pickCodexCompanionThread(threads: CodexThread[], preferredThreadId?: string | null) {
  if (preferredThreadId) {
    const preferred = threads.find((thread) => thread.id === preferredThreadId) ?? null;
    if (preferred) return preferred;
  }
  if (threads.length === 0) return null;
  return [...threads].sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
}

export function createCodexCompanionSnapshot(input: {
  hostId: string;
  hostLabel: string;
  thread: CodexThread;
  pendingCommands?: CodexCompanionPendingCommand[];
}): PolarisCompanionSnapshot {
  const title = input.thread.name?.trim() || input.thread.preview.trim() || 'Codex thread';
  const pendingCommands = reconcileCodexPendingCommands(input.thread, input.pendingCommands ?? []);
  return {
    hostId: input.hostId,
    hostLabel: input.hostLabel,
    threadKey: input.thread.id,
    conversationTitle: title,
    collaboratorId: null,
    collaboratorName: 'Codex',
    messages: [...buildCodexMessages(input.thread), ...buildPendingCodexMessages(pendingCommands)],
    updatedAt: input.thread.updatedAt * 1000
  };
}
