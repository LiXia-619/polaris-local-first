import type { Conversation, World } from '../../types/domain';

export type ProactiveReplyNotificationDraft = {
  kind: 'proactive-reply';
  collaboratorId: string;
  collaboratorName: string;
  conversationId: string;
  preview: string;
};

type BuildProactiveReplyNotificationArgs = {
  conversation: Conversation | null;
  collaboratorId: string;
  collaboratorName: string;
  messageCountBeforeReply: number;
  currentView: {
    activeWorld: World;
    activeConversationId: string | null;
  };
};

const PREVIEW_MAX_LENGTH = 120;

export function buildReplyPreview(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= PREVIEW_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, PREVIEW_MAX_LENGTH - 1).trimEnd()}…`;
}

export function buildProactiveReplyNotification({
  conversation,
  collaboratorId,
  collaboratorName,
  messageCountBeforeReply
}: BuildProactiveReplyNotificationArgs): ProactiveReplyNotificationDraft | null {
  if (!conversation) return null;

  const reply = conversation.messages
    .slice(messageCountBeforeReply)
    .reverse()
    .find((message) => message.role === 'assistant' && !message.toolInvocation && buildReplyPreview(message.content));
  if (!reply) return null;

  const preview = buildReplyPreview(reply.content);
  if (!preview) return null;

  return {
    kind: 'proactive-reply',
    collaboratorId,
    collaboratorName,
    conversationId: conversation.id,
    preview
  };
}
