import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanDisplayText } from './displayText';

describe('cleanDisplayText', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes replacement characters without touching normal copy', () => {
    expect(cleanDisplayText('你好呀 � 有什么想聊的')).toBe('你好呀 有什么想聊的');
  });

  it('keeps emoji when the runtime has no glyph probe available', () => {
    expect(cleanDisplayText('你好呀 👋')).toBe('你好呀 👋');
  });

  it('strips emoji glyphs in the iOS simulator runtime', () => {
    vi.stubGlobal('window', { __POLARIS_IOS_SIMULATOR__: true });

    expect(cleanDisplayText('你好呀 👋')).toBe('你好呀 ');
  });
});
