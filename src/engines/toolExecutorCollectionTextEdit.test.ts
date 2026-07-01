import { describe, expect, it } from 'vitest';
import {
  buildAmbiguousSnippetError,
  buildTextEditEffect,
  buildWholeFileEffect,
  countStringOccurrences,
  resolveProjectFileAppend,
  resolveProjectFileLineInsertion
} from './toolExecutorCollectionTextEdit';

describe('countStringOccurrences', () => {
  it('counts non-overlapping exact matches and ignores empty needles', () => {
    expect(countStringOccurrences('alpha beta alpha', 'alpha')).toBe(2);
    expect(countStringOccurrences('aaaa', 'aa')).toBe(2);
    expect(countStringOccurrences('alpha', '')).toBe(0);
  });
});

describe('resolveProjectFileLineInsertion', () => {
  it('resolves before and after offsets without changing newline ownership', () => {
    const content = 'one\r\ntwo\nthree';

    expect(resolveProjectFileLineInsertion(content, 2, 'before')).toEqual({
      offset: 5,
      lineNumber: 2
    });
    expect(resolveProjectFileLineInsertion(content, 2, 'after')).toEqual({
      offset: 9,
      lineNumber: 2
    });
    expect(resolveProjectFileLineInsertion(content, 4, 'after')).toBeNull();
  });

  it('allows inserting into the first line of an empty file only', () => {
    expect(resolveProjectFileLineInsertion('', 1, 'before')).toEqual({
      offset: 0,
      lineNumber: 1
    });
    expect(resolveProjectFileLineInsertion('', 2, 'after')).toBeNull();
  });
});

describe('resolveProjectFileAppend', () => {
  it('inserts HTML additions before the last closing body or html tag', () => {
    expect(resolveProjectFileAppend(
      { filePath: 'index.html', language: 'html' },
      '<html><body><main /></body></html>',
      '<script />'
    )).toEqual({
      content: '<html><body><main /><script /></body></html>',
      operation: 'inserted',
      offset: 20
    });

    expect(resolveProjectFileAppend(
      { filePath: 'index.html', language: 'html' },
      '<main /></html>',
      '<script />'
    )).toEqual({
      content: '<main /><script /></html>',
      operation: 'inserted',
      offset: 8
    });
  });

  it('appends non-HTML files at the end', () => {
    expect(resolveProjectFileAppend(
      { filePath: 'app.ts', language: 'typescript' },
      'const a = 1;',
      '\nconst b = 2;'
    )).toEqual({
      content: 'const a = 1;\nconst b = 2;',
      operation: 'appended',
      offset: 12
    });
  });
});

describe('project file effect builders', () => {
  it('records changed line ranges and excerpts for text edits', () => {
    const effect = buildTextEditEffect({
      projectId: 'project-1',
      fileId: 'file-1',
      filePath: 'index.ts',
      operation: 'replaced',
      beforeContent: 'one\ntwo\nthree',
      afterContent: 'one\nTWO\nTHREE\nthree',
      oldString: 'two',
      newString: 'TWO\nTHREE',
      matchOffset: 4,
      matchCount: 1
    });

    expect(effect).toMatchObject({
      changedLines: { start: 2, end: 3 },
      beforeLines: 3,
      afterLines: 4,
      insertedChars: 9,
      removedChars: 3,
      matchCount: 1,
      afterExcerptStartLine: 1,
      afterExcerptEndLine: 4
    });
    expect(effect.afterExcerpt).toContain('2: TWO');
  });

  it('records whole-file insert and delete evidence', () => {
    expect(buildWholeFileEffect({
      projectId: 'project-1',
      fileId: 'file-1',
      filePath: 'index.ts',
      operation: 'created',
      afterContent: 'one\ntwo'
    })).toMatchObject({
      changedLines: { start: 1, end: 2 },
      afterLines: 2,
      insertedChars: 7
    });
  });
});

describe('snippet errors', () => {
  it('includes file paths and line numbers for ambiguous matches', () => {
    expect(buildAmbiguousSnippetError({
      content: 'one\nsame\ntwo\nsame',
      snippet: 'same',
      count: 2,
      label: '锚点',
      guidance: '请提供更长片段。',
      filePath: 'index.ts'
    })).toContain('index.ts:2');
  });
});
