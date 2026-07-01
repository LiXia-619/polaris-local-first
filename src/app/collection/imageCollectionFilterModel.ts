import { IMAGE_ASSET_TAGS, type ImageAssetTag } from '../../engines/imageAssetTags';
import { resolveOwnerCollaboratorId } from '../../engines/collectionOwnership';
import type { Conversation, ImageAssetCard, Persona } from '../../types/domain';
import type { CodeFilterOption } from './codeCollectionFilterModel';

export type ImageCollaboratorFilter = 'all' | 'other' | string;
export type ImageTagFilter = 'all' | ImageAssetTag;

export function resolveImageCollaboratorId(card: ImageAssetCard, conversations: Conversation[]) {
  return resolveOwnerCollaboratorId(card, conversations);
}

export function buildImageCollaboratorOptions(
  cards: ImageAssetCard[],
  conversations: Conversation[],
  collaborators: Persona[]
): CodeFilterOption[] {
  const counts = new Map<string, number>();

  cards.forEach((card) => {
    const collaboratorId = resolveImageCollaboratorId(card, conversations);
    if (!collaboratorId) return;
    counts.set(collaboratorId, (counts.get(collaboratorId) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([collaboratorId, count]) => ({
      id: collaboratorId,
      label: collaborators.find((collaborator) => collaborator.id === collaboratorId)?.name ?? '未知协作者',
      count
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function countOtherImageCards(cards: ImageAssetCard[], conversations: Conversation[]) {
  return cards.filter((card) => !resolveImageCollaboratorId(card, conversations)).length;
}

export function buildImageTagOptions(cards: ImageAssetCard[]): CodeFilterOption[] {
  return IMAGE_ASSET_TAGS
    .map((tag) => ({
      id: tag,
      label: tag,
      count: cards.filter((card) => card.tags.includes(tag)).length
    }))
    .filter((option) => option.count > 0);
}
