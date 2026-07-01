import { describe, expect, it } from 'vitest';
import { retrieveRelevantCollectionCards } from './chatCollectionCardRetrieval';
import type { CodeCard, Conversation, Persona } from '../../types/domain';

function createCard(overrides: Partial<CodeCard> = {}): CodeCard {
  return {
    id: 'card-1',
    title: 'Landing Hero',
    language: 'tsx',
    code: 'export function Hero() { return <section>hello</section>; }',
    tags: ['首页', 'Hero'],
    createdAt: 1,
    updatedAt: 1,
    kind: 'card',
    source: 'chat-generated',
    ...overrides
  };
}

describe('retrieveRelevantCollectionCards', () => {
  it('returns directory metadata without embedding card content', () => {
    const cards = [
      createCard(),
      createCard({
        id: 'card-2',
        title: 'Footer',
        code: 'export function Footer() { return <footer>bye</footer>; }',
        tags: ['页脚'],
        updatedAt: 2
      })
    ];

    const result = retrieveRelevantCollectionCards({
      cards,
      conversations: [] as Conversation[],
      personas: [] as Persona[],
      activeCardId: 'card-1',
      messages: [{ role: 'user', content: '帮我看看 footer 那张卡' }]
    });

    expect(result[0]).toEqual({
      id: 'card-2',
      title: 'Footer',
      language: 'tsx',
      tags: ['页脚'],
      originLabel: '未知协作者'
    });
    expect('content' in result[0]).toBe(false);
  });
});
