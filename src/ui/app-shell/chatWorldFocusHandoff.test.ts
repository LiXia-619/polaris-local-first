import { describe, expect, it, vi } from 'vitest';
import { blurChatWorldFocus, shouldBlurChatWorldFocus } from './chatWorldFocusHandoff';

function createFocusNode({
  closestResult = true,
  tagName = 'textarea',
  type
}: {
  closestResult?: boolean;
  tagName?: string;
  type?: string;
} = {}) {
  return {
    blur: vi.fn(),
    closest: vi.fn((selector: string) => selector === '.chat-frame' && closestResult ? {} : null),
    tagName,
    type
  };
}

describe('shouldBlurChatWorldFocus', () => {
  it('matches text entry focus inside the chat frame', () => {
    expect(shouldBlurChatWorldFocus(createFocusNode())).toBe(true);
  });

  it('ignores collection-side text entry focus', () => {
    expect(shouldBlurChatWorldFocus(createFocusNode({ closestResult: false }))).toBe(false);
  });

  it('ignores non-text input controls', () => {
    expect(shouldBlurChatWorldFocus(createFocusNode({ tagName: 'input', type: 'checkbox' }))).toBe(false);
  });
});

describe('blurChatWorldFocus', () => {
  it('blurs chat text entry focus and reports the handoff', () => {
    const node = createFocusNode();

    expect(blurChatWorldFocus(node)).toBe(true);
    expect(node.blur).toHaveBeenCalledTimes(1);
  });

  it('leaves non-chat focus untouched', () => {
    const node = createFocusNode({ closestResult: false });

    expect(blurChatWorldFocus(node)).toBe(false);
    expect(node.blur).not.toHaveBeenCalled();
  });
});
