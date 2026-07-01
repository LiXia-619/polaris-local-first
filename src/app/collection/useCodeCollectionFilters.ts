import { useMemo } from 'react';
import type { CodeCard, Conversation } from '../../types/domain';
import { filterCodeCardsForCollaboratorScope } from '../../engines/collectionOwnership';
import {
  buildCodeTagOptions
} from './codeCollectionFilterModel';

type UseCodeCollectionFiltersInput = {
  cards: CodeCard[];
  conversations: Conversation[];
  collaboratorScopeId?: string | null;
  availableTags: string[];
  searchTerm: string;
  fileCount?: number;
};

export function useCodeCollectionFilters({
  cards,
  conversations,
  collaboratorScopeId,
  availableTags,
  searchTerm
}: UseCodeCollectionFiltersInput) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const searchedCards = useMemo(
    () =>
      cards.filter((card) => {
        if (card.kind === 'room-rule') return false;
        if (!normalizedSearch) return true;
        const searchBody = [card.title, card.language, card.tags.join(' '), card.code].join('\n').toLowerCase();
        return searchBody.includes(normalizedSearch);
      }),
    [cards, normalizedSearch]
  );
  const filteredCards = useMemo(
    () => filterCodeCardsForCollaboratorScope(searchedCards, conversations, collaboratorScopeId),
    [collaboratorScopeId, conversations, searchedCards]
  );
  const tagOptions = useMemo(
    () => buildCodeTagOptions(filteredCards, availableTags),
    [availableTags, filteredCards]
  );

  return {
    filteredCards,
    tagFilter: 'all' as const,
    tagOptions,
    setTagFilter: () => undefined
  };
}
