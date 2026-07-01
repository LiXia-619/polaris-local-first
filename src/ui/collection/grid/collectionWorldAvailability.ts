import type { CodeCard, Conversation, ImageAssetCard } from '../../../types/domain';

type CollectionWorldAvailabilityArgs = {
  conversations: Conversation[];
  cards: CodeCard[];
  imageCards: ImageAssetCard[];
};

export function hasCollectionWorldContent({
  conversations,
  cards,
  imageCards
}: CollectionWorldAvailabilityArgs) {
  const hasArchivedConversation = conversations.some((conversation) =>
    conversation.messages.some(
      (message) =>
        !message.toolInvocation && (message.content.trim() || (message.attachments?.length ?? 0) > 0)
    )
  );

  return hasArchivedConversation || cards.length > 0 || imageCards.length > 0;
}
