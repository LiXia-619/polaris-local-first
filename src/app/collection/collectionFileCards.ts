import { resolveConversationCollaboratorId } from '../../engines/conversationOwnership';
import type { ChatAttachment, Conversation } from '../../types/domain';

export type CollectionFileCard = {
  id: string;
  assetId: string;
  attachmentId: string;
  conversationId: string;
  conversationTitle: string;
  collaboratorId: string | null;
  messageId: string;
  name: string;
  mimeType: string;
  size: number;
  textPreview: string | null;
  updatedAt: number;
};

function normalizeSearchPreview(textContent: string | undefined) {
  const normalized = textContent?.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.slice(0, 120);
}

function buildFileSearchBody(card: CollectionFileCard) {
  return [
    card.name,
    card.mimeType,
    card.conversationTitle,
    card.textPreview ?? ''
  ]
    .join('\n')
    .toLowerCase();
}

function toFileCard(
  conversation: Conversation,
  messageId: string,
  attachment: ChatAttachment,
  updatedAt: number
): CollectionFileCard {
  return {
    id: `${messageId}:${attachment.id}`,
    assetId: attachment.assetId,
    attachmentId: attachment.id,
    conversationId: conversation.id,
    conversationTitle: conversation.title.trim() || '未命名对话',
    collaboratorId: resolveConversationCollaboratorId(conversation),
    messageId,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    textPreview: normalizeSearchPreview(attachment.textContent),
    updatedAt
  };
}

export function buildCollectionFileCards(params: {
  conversations: Conversation[];
  collaboratorScopeId?: string | null;
  searchTerm: string;
}) {
  const { conversations, collaboratorScopeId, searchTerm } = params;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const fileCards = conversations.flatMap((conversation) => {
    if (collaboratorScopeId && resolveConversationCollaboratorId(conversation) !== collaboratorScopeId) {
      return [];
    }

    return conversation.messages.flatMap((message) => (
      (message.attachments ?? [])
        .filter((attachment) => attachment.kind === 'file' && !attachment.clearedAt)
        .map((attachment) => toFileCard(conversation, message.id, attachment, message.timestamp))
    ));
  });

  const searchedCards = normalizedSearch
    ? fileCards.filter((card) => buildFileSearchBody(card).includes(normalizedSearch))
    : fileCards;

  return [...searchedCards].sort((left, right) => right.updatedAt - left.updatedAt);
}
