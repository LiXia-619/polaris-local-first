import { describe, it, expect } from 'vitest';
import { estimateTextTokens, estimateConversationMessageTokens } from './requestTokenEstimation';

describe('estimateTextTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTextTokens('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(estimateTextTokens('   ')).toBe(0);
  });

  it('estimates ~1 token per 4 characters', () => {
    expect(estimateTextTokens('abcd')).toBe(1);
    expect(estimateTextTokens('abcde')).toBe(2);
    expect(estimateTextTokens('abcdefgh')).toBe(2);
  });

  it('trims before estimating', () => {
    expect(estimateTextTokens('  ab  ')).toBe(1);
  });

  it('handles CJK text', () => {
    const chinese = '你好世界测试文本';
    expect(estimateTextTokens(chinese)).toBeGreaterThan(0);
  });
});

describe('estimateConversationMessageTokens', () => {
  it('includes message overhead', () => {
    const msg = { id: '1', role: 'user' as const, content: '', timestamp: 0 };
    // empty content → 0 text tokens + 12 overhead
    expect(estimateConversationMessageTokens(msg as any)).toBe(12);
  });

  it('counts content tokens plus overhead', () => {
    const msg = { id: '1', role: 'user' as const, content: 'Hello world test!', timestamp: 0 };
    const textTokens = estimateTextTokens('Hello world test!');
    expect(estimateConversationMessageTokens(msg as any)).toBe(textTokens + 12);
  });

  it('adds image attachment tokens', () => {
    const msg = {
      id: '1', role: 'user' as const, content: 'look', timestamp: 0,
      attachments: [{ kind: 'image', textContent: '' }]
    };
    const result = estimateConversationMessageTokens(msg as any);
    // content(1) + image(200) + file overhead(0 text) + message overhead(12)
    expect(result).toBeGreaterThanOrEqual(212);
  });

  it('estimates text attachments from the auto-inline portion only', () => {
    const longText = '聊天记录'.repeat(30_000);
    const msg = {
      id: '1',
      role: 'user' as const,
      content: '',
      timestamp: 0,
      attachments: [{
        id: 'attachment-1',
        assetId: 'asset-1',
        kind: 'file' as const,
        name: '聊天记录.txt',
        mimeType: 'text/plain',
        size: longText.length,
        textContent: longText
      }]
    };

    const result = estimateConversationMessageTokens(msg);

    expect(result).toBe(estimateTextTokens(longText.slice(0, 6_000)) + 40 + 12);
  });

  it('shares the auto-inline estimate budget across text attachments', () => {
    const firstText = '一'.repeat(8_000);
    const secondText = '二'.repeat(8_000);
    const msg = {
      id: '1',
      role: 'user' as const,
      content: '',
      timestamp: 0,
      attachments: [
        {
          id: 'attachment-1',
          assetId: 'asset-1',
          kind: 'file' as const,
          name: '上.txt',
          mimeType: 'text/plain',
          size: firstText.length,
          textContent: firstText
        },
        {
          id: 'attachment-2',
          assetId: 'asset-2',
          kind: 'file' as const,
          name: '下.txt',
          mimeType: 'text/plain',
          size: secondText.length,
          textContent: secondText
        }
      ]
    };

    const result = estimateConversationMessageTokens(msg);

    expect(result).toBe(
      estimateTextTokens(firstText.slice(0, 6_000))
      + estimateTextTokens(secondText.slice(0, 6_000))
      + 40
      + 40
      + 12
    );
  });
});
