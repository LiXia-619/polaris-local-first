import type { CodeCard, Conversation, ImageAssetCard, Persona } from '../types/domain';
import { resolveOwnerCollaboratorId } from './collectionOwnership';

export function codeCardBlockLabel(card: CodeCard) {
  if (card.originBlockTitle?.trim()) return card.originBlockTitle.trim();
  if (typeof card.originBlockIndex === 'number') return `第 ${card.originBlockIndex + 1} 段代码`;
  return null;
}

function resolveOwnerDisplayName(ownerCollaboratorId: string | null, personas: Persona[]) {
  if (!ownerCollaboratorId) return '未知协作者';
  return personas.find((persona) => persona.id === ownerCollaboratorId)?.name ?? '未知协作者';
}

export function codeCardLineageLabel(card: CodeCard, conversations: Conversation[]) {
  const conversation = conversations.find((entry) => entry.id === card.originConversationId);
  if (!conversation) {
    return card.originConversationId ? '来源对话已不存在' : null;
  }

  const blockLabel = codeCardBlockLabel(card);
  return blockLabel ? `${conversation.title} · ${blockLabel}` : conversation.title;
}

export function codeCardOriginLabel(
  card: CodeCard,
  conversations: Conversation[],
  personas: Persona[]
) {
  const ownerCollaboratorId = resolveOwnerCollaboratorId(card, conversations);
  const ownerLabel = resolveOwnerDisplayName(ownerCollaboratorId, personas);
  const lineageLabel = codeCardLineageLabel(card, conversations);
  return lineageLabel ? `${ownerLabel} · ${lineageLabel}` : ownerLabel;
}

export function imageAssetLineageLabel(card: ImageAssetCard, conversations: Conversation[]) {
  const conversation = conversations.find((entry) => entry.id === card.originConversationId);
  if (!conversation) {
    return card.originConversationId ? '来源对话已不存在' : null;
  }

  return conversation.title;
}

export function imageAssetOriginLabel(
  card: ImageAssetCard,
  conversations: Conversation[],
  personas: Persona[]
) {
  const ownerCollaboratorId = resolveOwnerCollaboratorId(card, conversations);
  const ownerLabel = resolveOwnerDisplayName(ownerCollaboratorId, personas);
  const lineageLabel = imageAssetLineageLabel(card, conversations);
  return lineageLabel ? `来自 ${ownerLabel} · ${lineageLabel}` : `来自 ${ownerLabel}`;
}
