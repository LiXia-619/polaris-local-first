import { describe, expect, it } from 'vitest';
import { buildPersonaMemoryDocHealth, buildWorkspaceReferenceDocHealth } from './docBodyConsistency';
import type { PersistedDbEntry } from '../persistence';

const kv = (entries: Array<{ key: string; value: unknown }>): PersistedDbEntry[] => entries;

describe('buildPersonaMemoryDocHealth', () => {
  it('counts split/chunked bodies and flags ones with no owning reference doc', () => {
    const health = buildPersonaMemoryDocHealth(kv([
      { key: 'persona-state-v2', value: { personas: [{ id: 'pharos', memory: { referenceDocs: [{ id: 'doc-1' }] } }] } },
      { key: 'persona-memory-doc-content-v1', value: { version: 1, docs: { 'pharos:doc-1': 'legacy' } } },
      { key: 'persona-memory-doc-content-v2:pharos:doc-1', value: 'split body' },
      { key: 'persona-memory-doc-content-v2:pharos:doc-deleted', value: 'orphan split body' },
      { key: 'persona-memory-doc-content-v3:pharos:doc-1:0', value: 'chunk 0' },
      { key: 'persona-memory-doc-content-v3:pharos:doc-1:1', value: 'chunk 1' },
      { key: 'persona-memory-doc-content-v3:pharos:doc-deleted:0', value: 'orphan chunk' }
    ]));

    expect(health).toEqual({
      splitDocBodyCount: 2,
      orphanedSplitDocBodyCount: 1,
      chunkedDocBodyCount: 2,
      chunkedDocBodyChunkCount: 3,
      orphanedChunkedDocBodyCount: 1,
      legacyDocBodyCount: 1
    });
  });

  it('returns zeros for an empty store', () => {
    expect(buildPersonaMemoryDocHealth(kv([]))).toEqual({
      splitDocBodyCount: 0,
      orphanedSplitDocBodyCount: 0,
      chunkedDocBodyCount: 0,
      chunkedDocBodyChunkCount: 0,
      orphanedChunkedDocBodyCount: 0,
      legacyDocBodyCount: 0
    });
  });
});

describe('buildWorkspaceReferenceDocHealth', () => {
  it('counts split/chunked bodies against the collection-state doc directory', () => {
    const health = buildWorkspaceReferenceDocHealth(kv([
      { key: 'collection-state-v2', value: { workspaceReferenceDocs: [{ id: 'workspace-doc-1' }] } },
      { key: 'workspace-reference-doc-content-v1:workspace-doc-1', value: 'split body' },
      { key: 'workspace-reference-doc-content-v1:workspace-doc-deleted', value: 'orphan split body' },
      { key: 'workspace-reference-doc-content-v2:workspace-doc-1:0', value: 'chunk 0' },
      { key: 'workspace-reference-doc-content-v2:workspace-doc-1:1', value: 'chunk 1' },
      { key: 'workspace-reference-doc-content-v2:workspace-doc-deleted:0', value: 'orphan chunk' }
    ]));

    expect(health).toEqual({
      splitDocBodyCount: 2,
      orphanedSplitDocBodyCount: 1,
      chunkedDocBodyCount: 2,
      chunkedDocBodyChunkCount: 3,
      orphanedChunkedDocBodyCount: 1
    });
  });
});
