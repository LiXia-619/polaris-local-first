import { describe, expect, it } from 'vitest';
import type { CodeCard, Conversation, ImageAssetCard } from '../types/domain';
import { backfillOwnership, filterCodeCardsForCollaboratorScope, filterImageCardsForCollaboratorScope } from './collectionOwnership';

function makeCard(seed: Partial<CodeCard> & Pick<CodeCard, 'id' | 'title'>): CodeCard {
  return {
    id: seed.id,
    kind: 'card',
    title: seed.title,
    language: seed.language ?? 'html',
    code: seed.code ?? '<div />',
    tags: seed.tags ?? [],
    ownerCollaboratorId: seed.ownerCollaboratorId,
    source: seed.source ?? 'manual',
    createdAt: seed.createdAt ?? 1,
    updatedAt: seed.updatedAt ?? 1,
    originConversationId: seed.originConversationId
  };
}

function makeImageCard(seed: Partial<ImageAssetCard> & Pick<ImageAssetCard, 'id'>): ImageAssetCard {
  return {
    id: seed.id,
    assetId: seed.assetId ?? `asset-${seed.id}`,
    title: seed.title ?? 'Image',
    tags: seed.tags ?? [],
    ownerCollaboratorId: seed.ownerCollaboratorId,
    source: seed.source ?? 'manual',
    createdAt: seed.createdAt ?? 1,
    updatedAt: seed.updatedAt ?? 1,
    originConversationId: seed.originConversationId,
    originMessageId: seed.originMessageId,
    originAttachmentId: seed.originAttachmentId
  };
}

describe('filterCodeCardsForCollaboratorScope', () => {
  it('returns the full list in aggregate scope', () => {
    const cards = [
      makeCard({ id: 'card-1', title: 'A', ownerCollaboratorId: 'pharos' }),
      makeCard({ id: 'card-2', title: 'B', ownerCollaboratorId: 'lyra' })
    ];

    expect(filterCodeCardsForCollaboratorScope(cards, [], null)).toEqual(cards);
  });

  it('keeps group-origin cards out of aggregate collaborator shelves', () => {
    const cards = [
      makeCard({ id: 'card-1', title: 'A', originConversationId: 'conv-1' }),
      makeCard({ id: 'card-2', title: 'B', originConversationId: 'conv-group' })
    ];
    const conversations: Conversation[] = [
      { id: 'conv-1', title: 'one', collaboratorId: 'pharos', updatedAt: 1, pinnedAt: null, messages: [] },
      { id: 'conv-group', title: 'group', collaboratorId: null, groupRoomId: 'group-1', updatedAt: 1, pinnedAt: null, messages: [] }
    ];

    expect(filterCodeCardsForCollaboratorScope(cards, conversations, null).map((card) => card.id)).toEqual(['card-1']);
  });

  it('keeps only cards owned by the scoped collaborator', () => {
    const cards = [
      makeCard({ id: 'card-1', title: 'A', ownerCollaboratorId: 'pharos' }),
      makeCard({ id: 'card-2', title: 'B', ownerCollaboratorId: 'lyra' }),
      makeCard({ id: 'card-3', title: 'C', ownerCollaboratorId: 'pharos' })
    ];

    expect(filterCodeCardsForCollaboratorScope(cards, [], 'pharos').map((card) => card.id)).toEqual([
      'card-1',
      'card-3'
    ]);
  });

  it('falls back to origin conversation ownership when ownerCollaboratorId is absent', () => {
    const cards = [
      makeCard({ id: 'card-1', title: 'A', originConversationId: 'conv-1' }),
      makeCard({ id: 'card-2', title: 'B', originConversationId: 'conv-2' })
    ];
    const conversations: Conversation[] = [
      { id: 'conv-1', title: 'one', collaboratorId: 'pharos', updatedAt: 1, pinnedAt: null, messages: [] },
      { id: 'conv-2', title: 'two', collaboratorId: 'lyra', updatedAt: 1, pinnedAt: null, messages: [] }
    ];

    expect(filterCodeCardsForCollaboratorScope(cards, conversations, 'pharos').map((card) => card.id)).toEqual([
      'card-1'
    ]);
  });
});

describe('filterImageCardsForCollaboratorScope', () => {
  it('keeps only image materials owned by the scoped collaborator', () => {
    const cards = [
      makeImageCard({ id: 'image-1', ownerCollaboratorId: 'pharos' }),
      makeImageCard({ id: 'image-2', ownerCollaboratorId: 'lyra' }),
      makeImageCard({ id: 'image-3', originConversationId: 'conv-1' })
    ];
    const conversations: Conversation[] = [
      { id: 'conv-1', title: 'one', collaboratorId: 'pharos', updatedAt: 1, pinnedAt: null, messages: [] }
    ];

    expect(filterImageCardsForCollaboratorScope(cards, conversations, 'pharos').map((card) => card.id)).toEqual([
      'image-1',
      'image-3'
    ]);
  });

  it('keeps group-origin images out of aggregate collaborator shelves', () => {
    const cards = [
      makeImageCard({ id: 'image-1', originConversationId: 'conv-1' }),
      makeImageCard({ id: 'image-2', originConversationId: 'conv-group' })
    ];
    const conversations: Conversation[] = [
      { id: 'conv-1', title: 'one', collaboratorId: 'pharos', updatedAt: 1, pinnedAt: null, messages: [] },
      { id: 'conv-group', title: 'group', collaboratorId: null, groupRoomId: 'group-1', updatedAt: 1, pinnedAt: null, messages: [] }
    ];

    expect(filterImageCardsForCollaboratorScope(cards, conversations, null).map((card) => card.id)).toEqual(['image-1']);
  });
});

describe('backfillOwnership', () => {
  it('backfills missing owners from origin conversations for any collection item', () => {
    const cards = [
      makeCard({ id: 'card-1', title: 'A', originConversationId: 'conv-1' }),
      makeCard({ id: 'card-2', title: 'B', ownerCollaboratorId: 'lyra', originConversationId: 'conv-1' })
    ];
    const conversations: Conversation[] = [
      { id: 'conv-1', title: 'one', collaboratorId: 'pharos', updatedAt: 1, pinnedAt: null, messages: [] }
    ];

    const result = backfillOwnership(cards, conversations);

    expect(result).not.toBe(cards);
    expect(result.map((card) => card.ownerCollaboratorId)).toEqual(['pharos', 'lyra']);
  });

  it('returns the original list when nothing changes', () => {
    const imageCards = [
      makeImageCard({ id: 'image-1', ownerCollaboratorId: 'pharos', originConversationId: 'conv-1' })
    ];

    expect(backfillOwnership(imageCards, [])).toBe(imageCards);
  });
});
