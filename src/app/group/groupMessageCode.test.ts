import { describe, expect, it } from 'vitest';
import { condenseFencedCode, splitFencedCode } from './groupMessageCode';

describe('splitFencedCode', () => {
  it('keeps plain text untouched', () => {
    const result = splitFencedCode('今晚先把首页改完，明天联调。');
    expect(result.text).toBe('今晚先把首页改完，明天联调。');
    expect(result.codeBlocks).toEqual([]);
  });

  it('extracts a closed fenced block and keeps surrounding text', () => {
    const result = splitFencedCode('做好了：\n```ts\nconst a = 1;\nconst b = 2;\n```\n直接能用。');
    expect(result.text).toBe('做好了：\n\n直接能用。');
    expect(result.codeBlocks).toEqual([
      { language: 'ts', code: 'const a = 1;\nconst b = 2;', lineCount: 2 }
    ]);
  });

  it('extracts multiple blocks with languages', () => {
    const result = splitFencedCode('```css\n.a { color: red; }\n```\n中间说明\n```\nplain\n```');
    expect(result.text).toBe('中间说明');
    expect(result.codeBlocks).toHaveLength(2);
    expect(result.codeBlocks[0].language).toBe('css');
    expect(result.codeBlocks[1].language).toBe('');
  });

  it('collects a trailing unclosed fence instead of leaking half a block', () => {
    const result = splitFencedCode('开始写了：\n```js\nlet x = 1;\nlet y = 2;');
    expect(result.text).toBe('开始写了：');
    expect(result.codeBlocks).toEqual([
      { language: 'js', code: 'let x = 1;\nlet y = 2;', lineCount: 2 }
    ]);
  });

  it('returns empty text when the message is code only', () => {
    const result = splitFencedCode('```py\nprint(1)\n```');
    expect(result.text).toBe('');
    expect(result.codeBlocks).toHaveLength(1);
  });
});

describe('condenseFencedCode', () => {
  it('returns content unchanged when there is no code', () => {
    expect(condenseFencedCode('改完了，等你们看。')).toBe('改完了，等你们看。');
  });

  it('replaces code blocks with line-count markers', () => {
    const condensed = condenseFencedCode('做好了：\n```css\n.a {}\n.b {}\n```\n直接能用。');
    expect(condensed).toBe('做好了：\n\n直接能用。\n〔代码 2 行 · css〕');
    expect(condensed).not.toContain('.a {}');
  });

  it('handles code-only messages with marker only', () => {
    expect(condenseFencedCode('```js\nlet x = 1;\n```')).toBe('〔代码 1 行 · js〕');
  });
});
