import { describe, expect, it } from 'vitest';
import { isWorldFrameInteractive } from './worldFrameInteractivity';

describe('isWorldFrameInteractive', () => {
  it('allows the settled active world to receive input', () => {
    expect(isWorldFrameInteractive('collection', 'collection', 'collection')).toBe(true);
  });

  it('blocks the old active world during priming toward another world', () => {
    expect(isWorldFrameInteractive('chat', 'collection', 'chat')).toBe(false);
  });

  it('blocks the target world until active world catches up', () => {
    expect(isWorldFrameInteractive('chat', 'collection', 'collection')).toBe(false);
  });
});
