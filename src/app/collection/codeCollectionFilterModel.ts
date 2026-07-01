import type { CodeCard, Conversation, Persona } from '../../types/domain';
import { resolveOwnerCollaboratorId } from '../../engines/collectionOwnership';

export const UNCATEGORIZED_CODE_TAG_FILTER = '__uncategorized__';
export const FILE_CODE_TAG_FILTER = '__files__';

export type CodeFilterOption = {
  id: string;
  label: string;
  count: number;
};

export type CodeCollaboratorFilter = 'all' | 'other' | string;
export type CodeTagFilter = 'all' | string;

function normalizeAllowedTags(allowedTags: string[]) {
  return allowedTags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);
}

export function resolveCardCollaboratorId(card: CodeCard, conversations: Conversation[]) {
  return resolveOwnerCollaboratorId(card, conversations);
}

export function buildCodeCollaboratorOptions(
  cards: CodeCard[],
  conversations: Conversation[],
  collaborators: Persona[]
): CodeFilterOption[] {
  const counts = new Map<string, number>();

  cards.forEach((card) => {
    const collaboratorId = resolveCardCollaboratorId(card, conversations);
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

export function countOtherCollaboratorCards(cards: CodeCard[], conversations: Conversation[]) {
  return cards.filter((card) => !resolveCardCollaboratorId(card, conversations)).length;
}

export function buildCodeTagOptions(cards: CodeCard[], allowedTags: string[]): CodeFilterOption[] {
  const allowed = normalizeAllowedTags(allowedTags);
  const discoveredTags = allowed.length > 0
    ? allowed
    : normalizeAllowedTags(cards.flatMap((card) => card.tags));
  const uncategorizedCount = cards.filter((card) => resolveRoomScopedTags(card, discoveredTags).length === 0).length;

  const options = discoveredTags.map((tag) => ({
    id: tag,
    label: tag,
    count: cards.filter((card) => resolveRoomScopedTags(card, discoveredTags).includes(tag)).length
  }));

  if (discoveredTags.length > 0 && uncategorizedCount > 0) {
    options.push({
      id: UNCATEGORIZED_CODE_TAG_FILTER,
      label: '未归类',
      count: uncategorizedCount
    });
  }

  return options;
}

export function resolveRoomScopedTags(card: CodeCard, allowedTags: string[]) {
  const allowed = normalizeAllowedTags(allowedTags);
  if (allowed.length === 0) return normalizeAllowedTags(card.tags);
  return card.tags.filter((tag) => allowed.includes(tag));
}

export function matchesRoomTagFilter(card: CodeCard, tagFilter: CodeTagFilter, allowedTags: string[]) {
  if (tagFilter === 'all') return true;
  const roomScopedTags = resolveRoomScopedTags(card, allowedTags);
  if (tagFilter === UNCATEGORIZED_CODE_TAG_FILTER) {
    return roomScopedTags.length === 0;
  }
  return roomScopedTags.includes(tagFilter);
}
