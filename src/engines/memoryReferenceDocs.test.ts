import { describe, expect, it } from 'vitest';
import type { PersonaMemoryReferenceDoc } from '../types/domain';
import { orderMemoryReferenceDocsNewestFirst } from './memoryReferenceDocs';

function makeDoc(id: string, updatedAt: number): PersonaMemoryReferenceDoc {
  return {
    id,
    title: id,
    summary: '',
    content: `${id} content`,
    source: 'user',
    updatedAt
  };
}

describe('orderMemoryReferenceDocsNewestFirst', () => {
  it('puts the newest long-term docs first', () => {
    const ordered = orderMemoryReferenceDocsNewestFirst([
      makeDoc('old', 10),
      makeDoc('new', 30),
      makeDoc('middle', 20)
    ]);

    expect(ordered.map((doc) => doc.id)).toEqual(['new', 'middle', 'old']);
  });

  it('does not mutate the stored input array while sorting', () => {
    const docs = [
      makeDoc('old', 10),
      makeDoc('new', 30)
    ];

    orderMemoryReferenceDocsNewestFirst(docs);

    expect(docs.map((doc) => doc.id)).toEqual(['old', 'new']);
  });
});
