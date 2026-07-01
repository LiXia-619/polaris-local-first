import { describe, expect, it } from 'vitest';
import { buildCollectionSourceHealth } from './collectionConsistency';
import { estimateLocalDataBytes } from './buckets';
import type { PersistedDbEntry } from '../persistence';

const kv = (entries: Array<{ key: string; value: unknown }>): PersistedDbEntry[] => entries;

describe('buildCollectionSourceHealth', () => {
  it('returns zeros when there is no collection state', () => {
    expect(buildCollectionSourceHealth(kv([]))).toEqual({
      projectFileCount: 0,
      projectFileContentBytes: 0,
      workspaceReferenceDocCount: 0
    });
  });

  it('counts project files, their content bytes, and workspace reference docs', () => {
    const health = buildCollectionSourceHealth(kv([
      {
        key: 'collection-state-v2',
        value: {
          projectFiles: [
            { id: 'file-1', content: 'project source body' },
            { id: 'file-2', content: 'second source body' },
            { id: 'file-3' }
          ],
          workspaceReferenceDocs: [{ id: 'workspace-doc-1' }]
        }
      }
    ]));

    expect(health).toEqual({
      projectFileCount: 3,
      projectFileContentBytes:
        estimateLocalDataBytes('project source body') + estimateLocalDataBytes('second source body'),
      workspaceReferenceDocCount: 1
    });
  });
});
