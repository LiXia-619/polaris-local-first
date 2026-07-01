import { describe, expect, it } from 'vitest';
import { normalizePersistedFollowMode, resolveReplyStageScrollTop } from './TimelineScroll';

describe('normalizePersistedFollowMode', () => {
  it('keeps reply-stage while generation is still active', () => {
    expect(normalizePersistedFollowMode('reply-stage', true)).toBe('reply-stage');
  });

  it('keeps reply-stage after generation settles', () => {
    expect(normalizePersistedFollowMode('reply-stage', false)).toBe('reply-stage');
  });

  it('leaves bottom and manual unchanged', () => {
    expect(normalizePersistedFollowMode('bottom', false)).toBe('bottom');
    expect(normalizePersistedFollowMode('manual', false)).toBe('manual');
  });
});

describe('resolveReplyStageScrollTop', () => {
  it('places the reply-stage row at the stable top offset when there is enough reserve', () => {
    expect(resolveReplyStageScrollTop({
      rowOffsetTop: 420,
      maxScrollTop: 1000
    })).toBe(402);
  });

  it('clamps to the current scroll range until reply-stage reserve is mounted', () => {
    expect(resolveReplyStageScrollTop({
      rowOffsetTop: 420,
      maxScrollTop: 260
    })).toBe(260);
  });
});
