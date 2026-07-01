import type { Conversation } from '../../types/domain';

export type ConversationArchiveLoadState = {
  loadedMessageConversationIds?: ReadonlySet<string>;
};

function hasRenderableConversationMessage(conversation: Conversation) {
  return conversation.messages.some((message) => {
    if (message.toolInvocation) return false;
    return Boolean(message.content.trim()) || (message.attachments?.length ?? 0) > 0;
  });
}

export function hasArchivedConversationContent(
  conversation: Conversation,
  loadState: ConversationArchiveLoadState = {}
) {
  if (conversation.messages.length > 0) {
    return hasRenderableConversationMessage(conversation);
  }

  if (!loadState.loadedMessageConversationIds) {
    return false;
  }

  return !loadState.loadedMessageConversationIds.has(conversation.id);
}
