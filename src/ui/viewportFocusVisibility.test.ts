import { describe, expect, it } from 'vitest';
import { resolveContainerScrollTop } from './viewportFocusVisibility';

describe('resolveContainerScrollTop', () => {
  it('keeps scroll position when target is already fully visible', () => {
    expect(resolveContainerScrollTop({
      currentScrollTop: 120,
      targetTop: 180,
      targetBottom: 220,
      visibleTop: 140,
      visibleBottom: 260
    })).toBe(120);
  });

  it('scrolls downward when the target falls under the keyboard-clipped bottom edge', () => {
    expect(resolveContainerScrollTop({
      currentScrollTop: 120,
      targetTop: 260,
      targetBottom: 312,
      visibleTop: 140,
      visibleBottom: 248
    })).toBe(184);
  });

  it('scrolls upward when the target sits above the visible top edge', () => {
    expect(resolveContainerScrollTop({
      currentScrollTop: 120,
      targetTop: 96,
      targetBottom: 132,
      visibleTop: 140,
      visibleBottom: 280
    })).toBe(76);
  });
});
