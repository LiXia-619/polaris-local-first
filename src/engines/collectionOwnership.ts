import type { CodeCard, Conversation, ImageAssetCard, ProjectFile } from '../types/domain';
import { isGroupConversation, isRetiredGroupConversation } from './conversationOwnership';

type OriginOwnedItem = {
  ownerCollaboratorId?: string;
  originConversationId?: string;
};

function resolveFallbackCollaboratorId(originConversationId: string | undefined, conversations: Conversation[]) {
  if (!originConversationId) return null;
  const conversation = conversations.find((entry) => entry.id === originConversationId) ?? null;
  if (!conversation || isGroupConversation(conversation) || isRetiredGroupConversation(conversation)) return null;
  return conversation.collaboratorId ?? null;
}

function hasGroupOrigin(item: OriginOwnedItem, conversations: Conversation[]) {
  if (!item.originConversationId) return false;
  const conversation = conversations.find((entry) => entry.id === item.originConversationId) ?? null;
  return conversation ? isGroupConversation(conversation) || isRetiredGroupConversation(conversation) : false;
}

export function resolveOwnerCollaboratorId(item: OriginOwnedItem, conversations: Conversation[]) {
  return item.ownerCollaboratorId ?? resolveFallbackCollaboratorId(item.originConversationId, conversations);
}

export function filterCodeCardsForCollaboratorScope(
  cards: CodeCard[],
  conversations: Conversation[],
  collaboratorId: string | null | undefined
) {
  if (!collaboratorId) return cards.filter((card) => !hasGroupOrigin(card, conversations));
  return cards.filter((card) => resolveOwnerCollaboratorId(card, conversations) === collaboratorId);
}

export function filterProjectFilesForCollaboratorScope(
  files: ProjectFile[],
  collaboratorId: string | null | undefined,
  activeProjectId?: string | null
) {
  if (activeProjectId) {
    return files.filter((file) => file.projectId === activeProjectId);
  }
  if (!collaboratorId) return files;
  return files.filter((file) => file.ownerCollaboratorId === collaboratorId);
}

export function filterImageCardsForCollaboratorScope(
  cards: ImageAssetCard[],
  conversations: Conversation[],
  collaboratorId: string | null | undefined
) {
  if (!collaboratorId) return cards.filter((card) => !hasGroupOrigin(card, conversations));
  return cards.filter((card) => resolveOwnerCollaboratorId(card, conversations) === collaboratorId);
}

export function backfillOwnership<T extends OriginOwnedItem>(items: T[], conversations: Conversation[]): T[] {
  let changed = false;
  const nextItems = items.map((item) => {
    if (item.ownerCollaboratorId) return item;
    const ownerCollaboratorId = resolveFallbackCollaboratorId(item.originConversationId, conversations);
    if (!ownerCollaboratorId) return item;
    changed = true;
    return {
      ...item,
      ownerCollaboratorId
    };
  });

  return changed ? nextItems : items;
}
