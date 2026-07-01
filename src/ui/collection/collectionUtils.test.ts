import { describe, expect, it } from 'vitest';
import { firstLines } from './collectionUtils';

describe('firstLines', () => {
  it('returns the full string when it has fewer lines than requested', () => {
    expect(firstLines('alpha\nbeta', 6)).toBe('alpha\nbeta');
  });

  it('matches split and slice semantics without requiring the full split', () => {
    const value = Array.from({ length: 12 }, (_, index) => `line-${index + 1}`).join('\n');
    expect(firstLines(value, 6)).toBe(value.split('\n').slice(0, 6).join('\n'));
  });

  it('returns an empty string for a zero-line preview', () => {
    expect(firstLines('alpha\nbeta', 0)).toBe('');
  });
});
