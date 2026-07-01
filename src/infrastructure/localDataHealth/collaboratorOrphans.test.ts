import { describe, expect, it } from 'vitest';
import { buildCollaboratorOrphanDiagnostics } from './collaboratorOrphans';
import type { LocalDataCensusReport } from '../../engines/localData/localDataCensusReport';
import type { PersistedDbEntry } from '../persistence';

// buildCollaboratorOrphanDiagnostics reads only knownCollaboratorIds off the census report.
const census = (knownCollaboratorIds: string[]): LocalDataCensusReport =>
  ({ knownCollaboratorIds } as LocalDataCensusReport);

const kv = (entries: Array<{ key: string; value: unknown }>): PersistedDbEntry[] => entries;

describe('buildCollaboratorOrphanDiagnostics', () => {
  it('returns nothing when every referenced owner is a current collaborator', () => {
    const result = buildCollaboratorOrphanDiagnostics({
      kv: kv([
        { key: 'chat-catalog-v1', value: { conversations: [{ id: 'c-1', collaboratorId: 'pharos' }] } },
        { key: 'persona-state-v2', value: { personas: [{ id: 'pharos' }] } }
      ])
    }, census(['pharos']));
    expect(result).toEqual([]);
  });

  it('flags a deleted collaborator still referenced by chat plus orphan memory bodies', () => {
    const deletedRowKey = 'local-data-v1:row:persona:collaborator:persona-deleted';
    const result = buildCollaboratorOrphanDiagnostics({
      kv: kv([
        { key: 'chat-catalog-v1', value: { conversations: [{ id: 'c-1', collaboratorId: 'persona-deleted' }] } },
        { key: 'persona-state-v2', value: { personas: [{ id: 'pharos' }] } },
        {
          key: deletedRowKey,
          value: { ref: { domain: 'persona', kind: 'collaborator', id: 'persona-deleted' }, state: 'deleted', updatedAt: 200, deletedAt: 210 }
        },
        { key: 'persona-memory-doc-content-v2:persona-deleted:doc-1', value: 'split body' },
        { key: 'persona-memory-doc-content-v3:persona-deleted:doc-2:0', value: 'chunk 0' },
        { key: 'persona-memory-doc-content-v3:persona-deleted:doc-2:1', value: 'chunk 1' }
      ])
    }, census(['pharos']));

    expect(result).toEqual([{
      collaboratorId: 'persona-deleted',
      rowKey: deletedRowKey,
      rowState: 'deleted',
      rowUpdatedAt: 200,
      rowDeletedAt: 210,
      repositoryRowPresent: true,
      personaStateHasId: false,
      referencedByLiveOwnerRef: true,
      hasOrphanMemoryBodies: true,
      splitMemoryBodyCount: 1,
      chunkedMemoryBodyCount: 1,
      chunkedMemoryBodyChunkCount: 2
    }]);
  });

  it('flags a memory-only orphan with no repository row', () => {
    const result = buildCollaboratorOrphanDiagnostics({
      kv: kv([
        { key: 'persona-state-v2', value: { personas: [{ id: 'pharos' }] } },
        { key: 'persona-memory-doc-content-v2:persona-memory-only:doc-3', value: 'memory-only body' }
      ])
    }, census(['pharos']));

    expect(result).toEqual([{
      collaboratorId: 'persona-memory-only',
      rowKey: 'local-data-v1:row:persona:collaborator:persona-memory-only',
      rowState: 'missing',
      rowUpdatedAt: null,
      rowDeletedAt: null,
      repositoryRowPresent: false,
      personaStateHasId: false,
      referencedByLiveOwnerRef: false,
      hasOrphanMemoryBodies: true,
      splitMemoryBodyCount: 1,
      chunkedMemoryBodyCount: 0,
      chunkedMemoryBodyChunkCount: 0
    }]);
  });
});
