import { describe, expect, it } from 'vitest';
import {
  buildBulletPromptLines,
  buildNumberedPromptLines,
  normalizePromptInlineText,
  summarizePromptInlineText
} from './promptFormatting';

describe('buildNumberedPromptLines', () => {
  it('formats items with stable one-based numbering', () => {
    expect(buildNumberedPromptLines(['alpha', 'beta'], (item) => item)).toEqual([
      '1. alpha',
      '2. beta'
    ]);
  });
});

describe('buildBulletPromptLines', () => {
  it('formats items with a stable prompt bullet', () => {
    expect(buildBulletPromptLines(['read', 'write'], (item) => item)).toEqual([
      '- read',
      '- write'
    ]);
  });
});

describe('normalizePromptInlineText', () => {
  it('compacts whitespace for single-line prompt summaries', () => {
    expect(normalizePromptInlineText('  hello\n\nworld\t ')).toBe('hello world');
  });
});

describe('summarizePromptInlineText', () => {
  it('keeps short text intact and trims long text with an ellipsis', () => {
    expect(summarizePromptInlineText('short', 10)).toBe('short');
    expect(summarizePromptInlineText('alpha beta gamma', 11)).toBe('alpha beta…');
  });
});
