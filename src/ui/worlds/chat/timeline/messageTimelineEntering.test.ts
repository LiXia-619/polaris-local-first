import { describe, expect, it } from 'vitest';
import { appendEnteringMessageIds } from './messageTimelineEntering';

describe('appendEnteringMessageIds', () => {
  it('keeps an existing entering user message while appending a newer assistant message', () => {
    expect(appendEnteringMessageIds(
      ['user_1'],
      ['assistant_1']
    )).toEqual(['user_1', 'assistant_1']);
  });

  it('dedupes repeated ids and ignores empty values', () => {
    expect(appendEnteringMessageIds(
      ['user_1'],
      ['user_1', '', null, undefined, 'assistant_1']
    )).toEqual(['user_1', 'assistant_1']);
  });
});
