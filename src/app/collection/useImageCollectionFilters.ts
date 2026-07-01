import { useEffect, useMemo, useState } from 'react';
import type { Conversation, ImageAssetCard, Persona } from '../../types/domain';
import {
  buildImageTagOptions,
  buildImageCollaboratorOptions,
  countOtherImageCards,
  resolveImageCollaboratorId,
  type ImageCollaboratorFilter,
  type ImageTagFilter
} from './imageCollectionFilterModel';

type UseImageCollectionFiltersInput = {
  cards: ImageAssetCard[];
  conversations: Conversation[];
  collaborators: Persona[];
  collaboratorScopeId?: string | null;
  searchTerm: string;
};

export function useImageCollectionFilters({
  cards,
  conversations,
  collaborators,
  collaboratorScopeId,
  searchTerm
}: UseImageCollectionFiltersInput) {
  const [collaboratorFilter, setCollaboratorFilter] = useState<ImageCollaboratorFilter>('all');
  const [tagFilter, setTagFilter] = useState<ImageTagFilter>('all');

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const searchedCards = useMemo(
    () =>
      cards.filter((card) => {
        const collaboratorId = resolveImageCollaboratorId(card, conversations);
        const collaboratorName = collaboratorId
          ? collaborators.find((collaborator) => collaborator.id === collaboratorId)?.name ?? ''
          : '';
        const conversationTitle = card.originConversationId
          ? conversations.find((conversation) => conversation.id === card.originConversationId)?.title ?? ''
          : '';
        const searchBody = [card.title, collaboratorName, conversationTitle, card.tags.join(' ')].join('\n').toLowerCase();
        return !normalizedSearch || searchBody.includes(normalizedSearch);
      }),
    [cards, collaborators, conversations, normalizedSearch]
  );
  const collaboratorOptions = useMemo(
    () => buildImageCollaboratorOptions(searchedCards, conversations, collaborators),
    [collaborators, conversations, searchedCards]
  );
  const otherCount = useMemo(
    () => countOtherImageCards(searchedCards, conversations),
    [conversations, searchedCards]
  );
  const scopedCards = useMemo(
    () =>
      searchedCards.filter((card) => {
        if (!collaboratorScopeId) return true;
        return resolveImageCollaboratorId(card, conversations) === collaboratorScopeId;
      }),
    [collaboratorScopeId, conversations, searchedCards]
  );
  const collaboratorFilteredCards = useMemo(
    () =>
      scopedCards.filter((card) => {
        if (collaboratorScopeId || collaboratorFilter === 'all') return true;
        if (collaboratorFilter === 'other') return !resolveImageCollaboratorId(card, conversations);
        return resolveImageCollaboratorId(card, conversations) === collaboratorFilter;
      }),
    [collaboratorFilter, collaboratorScopeId, conversations, scopedCards]
  );
  const tagOptions = useMemo(() => buildImageTagOptions(collaboratorFilteredCards), [collaboratorFilteredCards]);
  const filteredCards = useMemo(
    () =>
      collaboratorFilteredCards.filter((card) => {
        if (tagFilter === 'all') return true;
        return card.tags.includes(tagFilter);
      }),
    [collaboratorFilteredCards, tagFilter]
  );

  useEffect(() => {
    setCollaboratorFilter('all');
  }, [collaboratorScopeId]);

  useEffect(() => {
    if (collaboratorFilter !== 'all' && !collaboratorOptions.some((option) => option.id === collaboratorFilter)) {
      if (collaboratorFilter === 'other' && otherCount > 0) return;
      setCollaboratorFilter('all');
    }
  }, [collaboratorFilter, collaboratorOptions, otherCount]);

  useEffect(() => {
    if (tagFilter !== 'all' && !tagOptions.some((option) => option.id === tagFilter)) {
      setTagFilter('all');
    }
  }, [tagFilter, tagOptions]);

  return {
    collaboratorFilter,
    collaboratorOptions,
    otherCount,
    tagFilter,
    tagOptions,
    filteredCards,
    setCollaboratorFilter,
    setTagFilter
  };
}
