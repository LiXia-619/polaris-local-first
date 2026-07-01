import { describe, expect, it } from 'vitest';
import {
  collectDocumentBodyCompletenessIndex,
  declaredReferenceDocCharCount
} from './documentBodyCompleteness';

describe('collectDocumentBodyCompletenessIndex', () => {
  it('treats short readable chunk bodies as incomplete', () => {
    const index = collectDocumentBodyCompletenessIndex({
      kv: [
        { key: 'doc-chunk:doc-1:0', value: 'hello ' }
      ],
      splitPrefix: 'doc-body:',
      chunkPrefix: 'doc-chunk:',
      declaredCharCounts: new Map([['doc-1', 11]])
    });

    expect(index.bodyKeys).toEqual(new Set(['doc-1']));
    expect(index.completeKeys).toEqual(new Set());
    expect(index.chunkIssueKeys).toEqual(new Set(['doc-1']));
  });

  it('preserves existing unread body keys as present evidence for lightweight health scans', () => {
    const index = collectDocumentBodyCompletenessIndex({
      kv: [
        { key: 'doc-chunk:doc-1:0', value: undefined }
      ],
      splitPrefix: 'doc-body:',
      chunkPrefix: 'doc-chunk:',
      declaredCharCounts: new Map([['doc-1', 11]])
    });

    expect(index.bodyKeys).toEqual(new Set(['doc-1']));
    expect(index.completeKeys).toEqual(new Set(['doc-1']));
    expect(index.chunkIssueKeys).toEqual(new Set());
  });

  it('lets a bad chunk path override a split body for the same document', () => {
    const index = collectDocumentBodyCompletenessIndex({
      kv: [
        { key: 'doc-body:doc-1', value: 'hello world' },
        { key: 'doc-chunk:doc-1:1', value: 'world' }
      ],
      splitPrefix: 'doc-body:',
      chunkPrefix: 'doc-chunk:',
      declaredCharCounts: new Map([['doc-1', 11]])
    });

    expect(index.bodyKeys).toEqual(new Set(['doc-1']));
    expect(index.completeKeys).toEqual(new Set());
    expect(index.chunkIssueKeys).toEqual(new Set(['doc-1']));
  });
});

describe('declaredReferenceDocCharCount', () => {
  it('prefers finite directory charCount over inline content length', () => {
    expect(declaredReferenceDocCharCount({ content: 'hello', charCount: 11 })).toBe(11);
  });

  it('falls back to inline content length when charCount is absent or invalid', () => {
    expect(declaredReferenceDocCharCount({ content: 'hello' })).toBe(5);
    expect(declaredReferenceDocCharCount({ content: 'hello', charCount: Number.NaN })).toBe(5);
  });
});
