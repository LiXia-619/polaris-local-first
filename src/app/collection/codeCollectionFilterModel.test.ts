import { describe, expect, it } from 'vitest';
import {
  buildCodeCollaboratorOptions,
  buildCodeTagOptions,
  matchesRoomTagFilter,
  UNCATEGORIZED_CODE_TAG_FILTER
} from './codeCollectionFilterModel';
import type { CodeCard, Persona } from '../../types/domain';

function makeCard(seed: Partial<CodeCard>): CodeCard {
  return {
    id: seed.id ?? 'card',
    title: seed.title ?? 'Card',
    language: seed.language ?? 'txt',
    code: seed.code ?? 'hello',
    tags: seed.tags ?? [],
    source: seed.source ?? 'manual',
    createdAt: seed.createdAt ?? 1,
    updatedAt: seed.updatedAt ?? 1,
    kind: seed.kind ?? 'card',
    ownerCollaboratorId: seed.ownerCollaboratorId
  };
}

describe('buildCodeTagOptions', () => {
  it('adds an uncategorized option when room-scoped cards miss every declared tag', () => {
    const options = buildCodeTagOptions(
      [
        makeCard({ id: 'a', tags: ['html'] }),
        makeCard({ id: 'b', tags: ['css'] })
      ],
      ['html', '纯文本']
    );

    expect(options).toEqual([
      { id: 'html', label: 'html', count: 1 },
      { id: '纯文本', label: '纯文本', count: 0 },
      { id: UNCATEGORIZED_CODE_TAG_FILTER, label: '未归类', count: 1 }
    ]);
  });
});

describe('buildCodeCollaboratorOptions', () => {
  it('groups cards by collaborator id', () => {
    const options = buildCodeCollaboratorOptions(
      [
        makeCard({ id: 'a', ownerCollaboratorId: 'lyra' }),
        makeCard({ id: 'b', ownerCollaboratorId: 'lyra' }),
        makeCard({ id: 'c', ownerCollaboratorId: 'aster' })
      ],
      [],
      [
        { id: 'lyra', name: 'Lyra' } as Persona,
        { id: 'aster', name: 'Aster' } as Persona
      ] as Persona[]
    );

    expect(options).toEqual([
      { id: 'lyra', label: 'Lyra', count: 2 },
      { id: 'aster', label: 'Aster', count: 1 }
    ]);
  });
});

describe('matchesRoomTagFilter', () => {
  it('treats the uncategorized filter as cards with no room-scoped tag hits', () => {
    expect(
      matchesRoomTagFilter(makeCard({ tags: ['css'] }), UNCATEGORIZED_CODE_TAG_FILTER, ['html', '纯文本'])
    ).toBe(true);
    expect(
      matchesRoomTagFilter(makeCard({ tags: ['html'] }), UNCATEGORIZED_CODE_TAG_FILTER, ['html', '纯文本'])
    ).toBe(false);
  });
});
