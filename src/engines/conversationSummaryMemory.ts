import type { ChatMessage, Conversation } from '../types/domain';
import { isNaturalMemorySourceMessage } from './memoryNaturalSourceMessage';

export const DEFAULT_CONVERSATION_SUMMARY_SOURCE_CHARS = 50_000;

export type ConversationSummarySourceBatch = {
  batchId: string;
  sequence: number;
  sourceConversationIds: string[];
  sourceMessageIds: string[];
  sourceCharCount: number;
  text: string;
};

type ConversationSummarySourceRoleLabels = {
  userLabel: string;
  collaboratorName: string;
};

function normalizeSourceCharTarget(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_CONVERSATION_SUMMARY_SOURCE_CHARS;
  }
  return Math.floor(value);
}

function normalizeSourceLabel(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized || fallback;
}

function stripCodeBlocks(text: string) {
  return text.replace(/```[\s\S]*?```/g, '[代码块已略过]');
}

function formatSummarySourceRole(message: ChatMessage, labels: ConversationSummarySourceRoleLabels) {
  if (message.role === 'assistant') return labels.collaboratorName;
  return labels.userLabel;
}

function formatSummarySourceMessage(
  conversation: Conversation,
  message: ChatMessage,
  labels: ConversationSummarySourceRoleLabels
) {
  const title = conversation.title.trim() || '未命名对话';
  const role = formatSummarySourceRole(message, labels);
  const content = stripCodeBlocks(message.content).replace(/\r\n?/g, '\n').trim();
  if (!content) return '';
  return `[${title} · ${role} · ${new Date(message.timestamp || conversation.updatedAt || 0).toISOString()}]\n${content}`;
}

export function resolveConversationSummarySourceBatches(args: {
  conversations: Conversation[];
  currentCollaboratorId?: string | null;
  currentCollaboratorName?: string | null;
  userLabel?: string | null;
  targetSourceChars?: number;
}): ConversationSummarySourceBatch[] {
  const targetSourceChars = normalizeSourceCharTarget(args.targetSourceChars);
  const labels: ConversationSummarySourceRoleLabels = {
    userLabel: normalizeSourceLabel(args.userLabel, '用户'),
    collaboratorName: normalizeSourceLabel(args.currentCollaboratorName, '协作者')
  };
  const sourceEntries = args.conversations
    .filter((conversation) => (
      !args.currentCollaboratorId || conversation.collaboratorId === args.currentCollaboratorId
    ))
    .flatMap((conversation) => conversation.messages
      .filter(isNaturalMemorySourceMessage)
      .map((message) => ({
        conversation,
        message,
        text: formatSummarySourceMessage(conversation, message, labels)
      }))
      .filter((entry) => entry.text)
    )
    .sort((left, right) => left.message.timestamp - right.message.timestamp);

  const batches: ConversationSummarySourceBatch[] = [];
  let currentTexts: string[] = [];
  let currentConversationIds = new Set<string>();
  let currentMessageIds: string[] = [];
  let currentCharCount = 0;

  const flush = () => {
    if (!currentTexts.length) return;
    const sequence = batches.length + 1;
    batches.push({
      batchId: `conversation-summary-source:${sequence}`,
      sequence,
      sourceConversationIds: [...currentConversationIds],
      sourceMessageIds: currentMessageIds,
      sourceCharCount: currentCharCount,
      text: currentTexts.join('\n\n')
    });
    currentTexts = [];
    currentConversationIds = new Set<string>();
    currentMessageIds = [];
    currentCharCount = 0;
  };

  for (const entry of sourceEntries) {
    const nextCharCount = currentCharCount + entry.text.length;
    if (currentTexts.length > 0 && nextCharCount > targetSourceChars) {
      flush();
    }
    currentTexts.push(entry.text);
    currentConversationIds.add(entry.conversation.id);
    currentMessageIds.push(entry.message.id);
    currentCharCount += entry.text.length;
  }

  flush();
  return batches;
}
