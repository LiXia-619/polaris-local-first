import { describe, expect, it } from 'vitest';
import { buildDocumentLocalDataProjection } from './documentRows';

describe('buildDocumentLocalDataProjection', () => {
  it('projects complete document bodies and quarantines missing or partial bodies', () => {
    const projection = buildDocumentLocalDataProjection({
      version: 7,
      updatedAt: 100,
      state: {
        documents: [
          {
            id: 'persona-1:doc-1',
            kind: 'persona-memory-doc',
            title: 'Memory',
            summary: 'uses polaris-asset://asset-summary',
            declaredCharCount: 11,
            contentLoaded: false,
            body: {
              source: 'split',
              content: 'hello world',
              keys: ['persona-memory-doc-content-v2:persona-1:doc-1'],
              chunkIndexes: [],
              chunkCount: 0,
              contiguous: true
            },
            ownerRefs: [{ kind: 'persona', id: 'persona-1', label: 'Persona' }],
            updatedAt: 20,
            expectsBody: true
          },
          {
            id: 'workspace-doc-1',
            kind: 'workspace-reference-doc',
            title: 'Workspace',
            summary: '',
            declaredCharCount: 5,
            contentLoaded: false,
            body: {
              source: 'chunked',
              content: null,
              keys: [
                'workspace-reference-doc-content-v2:workspace-doc-1:0',
                'workspace-reference-doc-content-v2:workspace-doc-1:2'
              ],
              chunkIndexes: [0, 2],
              chunkCount: 2,
              contiguous: false
            },
            ownerRefs: [{ kind: 'workspace-doc', id: 'workspace-doc-1', label: 'Workspace' }],
            updatedAt: 30,
            expectsBody: true
          },
          {
            id: 'workspace-doc-tail-missing',
            kind: 'workspace-reference-doc',
            title: 'Workspace tail',
            summary: 'tail summary',
            declaredCharCount: 11,
            contentLoaded: false,
            body: {
              source: 'chunked',
              content: 'hello ',
              keys: [
                'workspace-reference-doc-content-v2:workspace-doc-tail-missing:0'
              ],
              chunkIndexes: [0],
              chunkCount: 1,
              contiguous: true
            },
            ownerRefs: [{ kind: 'workspace-doc', id: 'workspace-doc-tail-missing', label: 'Workspace tail' }],
            updatedAt: 35,
            expectsBody: true
          },
          {
            id: 'persona-orphan:old-doc',
            kind: 'orphan-body',
            title: 'persona-memory-doc:old-doc',
            summary: '',
            declaredCharCount: 4,
            contentLoaded: true,
            body: {
              source: 'legacy',
              content: 'stale',
              keys: ['persona-memory-doc-content-v1'],
              chunkIndexes: [],
              chunkCount: 0,
              contiguous: true
            },
            ownerRefs: [],
            updatedAt: 40,
            expectsBody: true
          }
        ]
      }
    });

    const completeRow = projection.objectRows.find((row) => row.ref.id === 'persona-1:doc-1');
    const partialChunkRow = projection.objectRows.find((row) => row.ref.id === 'workspace-doc-1');
    const tailMissingChunkRow = projection.objectRows.find((row) => row.ref.id === 'workspace-doc-tail-missing');
    const orphanRow = projection.objectRows.find((row) => row.ref.id === 'persona-orphan:old-doc');

    expect(projection.domainMetaRow.value).toEqual(expect.objectContaining({
      activeObjectCount: 1,
      totalObjectCount: 4,
      objectCounts: {
        'persona-memory-doc': 1,
        'workspace-reference-doc': 2,
        'orphan-body': 1
      },
      missingBodyCount: 0,
      incompleteChunkCount: 2,
      orphanBodyCount: 1,
      totalCharCount: 16
    }));
    expect(completeRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        actualCharCount: 11,
        storageSource: 'split',
        assetRefs: ['asset-summary'],
        ownerCount: 1
      })
    }));
    expect(partialChunkRow).toEqual(expect.objectContaining({
      state: 'incomplete',
      reason: 'missing-chunk',
      meta: expect.objectContaining({
        chunkIndexes: [0, 2],
        contentLoaded: false
      })
    }));
    expect(tailMissingChunkRow).toEqual(expect.objectContaining({
      state: 'incomplete',
      reason: 'missing-chunk',
      meta: expect.objectContaining({
        actualCharCount: 0,
        assetRefs: [],
        chunkIndexes: [0],
        content: '',
        contentLoaded: false
      })
    }));
    expect(orphanRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        orphan: true,
        storageSource: 'legacy'
      })
    }));
  });
});
