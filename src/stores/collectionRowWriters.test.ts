import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildCollectionLocalDataUnitOfWork,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getCollectionDomainMetaLocalDataRef,
  getCollectionObjectLocalDataRef,
  getLocalDataActiveDataSourceKey,
  getLocalDataRowKey,
  LOCAL_DATA_SCHEMA_VERSION,
  type CollectionDomainMetaRow,
  type CollectionLocalDataObjectKind,
  type CollectionObjectRow,
  type LocalDataActiveDataSourceRow,
  type LocalDataCommitMeta,
  type LocalDataStoredRow
} from '../engines/localData';
import {
  kvGet,
  kvSet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistedKvMutation,
  type PersistenceBackend
} from '../infrastructure/persistence';
import type { CodeCard, ProjectFile, RoomProject } from '../types/domain';
import {
  commitCollectionRowChangesFromStateIfActive,
  commitCollectionRowChangesIfActive
} from './collectionLocalDataPersistence';
import type { PersistedCollectionState } from './collectionStorePersistence';

let commitCount = 0;

function createMemoryPersistenceBackend(initialKv: PersistedDbEntry[] = []): PersistenceBackend {
  const stores = new Map<string, Map<string, unknown>>();
  stores.set('kv', new Map(initialKv.map((entry) => [entry.key, entry.value])));
  const getStore = (storeName: string) => {
    let store = stores.get(storeName);
    if (!store) {
      store = new Map();
      stores.set(storeName, store);
    }
    return store;
  };
  return {
    async dbStoreGet<T>(storeName: string, key: string) {
      return (getStore(storeName).get(key) as T | undefined) ?? null;
    },
    async dbStoreSet(storeName: string, key: string, value: unknown) {
      getStore(storeName).set(key, value);
    },
    async dbStoreDelete(storeName: string, key: string) {
      getStore(storeName).delete(key);
    },
    async dbStoreEntries<T>(storeName: string) {
      return Array.from(getStore(storeName).entries()).map(([key, value]) => ({ key, value: value as T }));
    },
    async dbStoreKeys(storeName: string) {
      return Array.from(getStore(storeName).keys());
    },
    async dbStoreClear(storeName: string) {
      getStore(storeName).clear();
    },
    async kvApplyMutations(mutations: PersistedKvMutation[]) {
      commitCount += 1;
      const store = getStore('kv');
      for (const mutation of mutations) {
        if (mutation.type === 'set') store.set(mutation.key, mutation.value);
        else store.delete(mutation.key);
      }
    },
    async kvReplaceAll(entries) {
      stores.set('kv', new Map(entries.map((entry) => [entry.key, entry.value])));
    }
  };
}

function card(seed: Partial<CodeCard> & Pick<CodeCard, 'id'>): CodeCard {
  return { title: seed.id, language: 'html', code: '', tags: [], source: 'manual', createdAt: 1, updatedAt: 1, ...seed };
}

function project(seed: Partial<RoomProject> & Pick<RoomProject, 'id'>): RoomProject {
  return { title: seed.id, slug: seed.id, fileIds: [], tags: [], source: 'manual', createdAt: 1, updatedAt: 1, ...seed };
}

function projectFile(seed: Partial<ProjectFile> & Pick<ProjectFile, 'id' | 'projectId'>): ProjectFile {
  return { filePath: seed.id, language: 'html', content: '', source: 'manual', createdAt: 1, updatedAt: 1, ...seed };
}

function collectionState(state: Partial<PersistedCollectionState> = {}): PersistedCollectionState {
  return {
    cards: [],
    imageCards: [],
    roomProjects: [],
    projectFiles: [],
    workspaceReferenceDocs: [],
    deletedBundledCardIds: [],
    ...state
  };
}

function activeSourceRow(meta: LocalDataCommitMeta): LocalDataActiveDataSourceRow {
  return {
    schemaVersion: LOCAL_DATA_SCHEMA_VERSION,
    key: getLocalDataActiveDataSourceKey(),
    activeDataSource: 'repository',
    activeCommitId: meta.commitId,
    stagingCommitId: null,
    updatedAt: meta.committedAt,
    domains: {
      collection: {
        domain: 'collection',
        version: meta.version,
        committedAt: meta.committedAt,
        commitId: meta.commitId
      }
    }
  };
}

async function promoteCollectionState(state: PersistedCollectionState, activeProjectId: string | null) {
  const repository = createLocalDataRepository({
    backend: createLocalDataKvBackend(),
    now: () => 100,
    createCommitId: () => 'collection:initial'
  });
  const meta = await repository.commit(buildCollectionLocalDataUnitOfWork({
    activeProjectId,
    state,
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 100
  }));
  await kvSet(getLocalDataActiveDataSourceKey(), activeSourceRow(meta));
}

function rawObjectRow(kind: CollectionLocalDataObjectKind, id: string) {
  return kvGet<LocalDataStoredRow<CollectionObjectRow<CollectionLocalDataObjectKind>>>(
    getLocalDataRowKey(getCollectionObjectLocalDataRef(kind, id))
  );
}

async function readObjectValue(kind: CollectionLocalDataObjectKind, id: string) {
  const row = await rawObjectRow(kind, id);
  if (!row || row.state !== 'complete') throw new Error(`${kind}:${id} is not complete`);
  return row.value;
}

async function readDomainMeta() {
  const row = await kvGet<LocalDataStoredRow<CollectionDomainMetaRow>>(
    getLocalDataRowKey(getCollectionDomainMetaLocalDataRef())
  );
  if (!row || row.state !== 'complete') throw new Error('collection domain meta is not complete');
  return row.value;
}

describe('commitCollectionRowChangesIfActive', () => {
  beforeEach(() => {
    commitCount = 0;
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  it('upserts one card without rewriting unrelated object rows', async () => {
    await promoteCollectionState(collectionState({
      cards: [card({ id: 'card-a', title: 'A' }), card({ id: 'card-b', title: 'B' })],
      roomProjects: [project({ id: 'project-1' })]
    }), 'project-1');
    const cardARowBefore = await rawObjectRow('card', 'card-a');
    commitCount = 0;

    const wrote = await commitCollectionRowChangesIfActive({
      changes: [{ type: 'upsert', kind: 'card', value: card({ id: 'card-b', title: 'B edited', updatedAt: 30 }) }]
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readObjectValue('card', 'card-b')).value).toEqual(expect.objectContaining({ title: 'B edited' }));
    // card-a untouched, byte-for-byte.
    expect(await rawObjectRow('card', 'card-a')).toEqual(cardARowBefore);
    const meta = await readDomainMeta();
    expect(meta.objectCounts.card).toBe(2);
    expect(meta.totalObjectCount).toBe(3);
    // The active-project pointer is preserved verbatim, not recomputed.
    expect(meta.activeProjectId).toBe('project-1');
  });

  it('writes a multi-object batch and the refreshed domain meta in one commit', async () => {
    await promoteCollectionState(collectionState({
      roomProjects: [project({ id: 'project-1' })]
    }), 'project-1');
    commitCount = 0;

    const wrote = await commitCollectionRowChangesIfActive({
      changes: [
        { type: 'upsert', kind: 'card', value: card({ id: 'card-new' }) },
        { type: 'upsert', kind: 'project-file', value: projectFile({ id: 'file-new', projectId: 'project-1' }) }
      ]
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    const meta = await readDomainMeta();
    expect(meta.objectCounts.card).toBe(1);
    expect(meta.objectCounts['project-file']).toBe(1);
    expect(meta.objectCounts.project).toBe(1);
    expect(meta.totalObjectCount).toBe(3);
  });

  it('tombstones one object and drops it from the counts', async () => {
    await promoteCollectionState(collectionState({
      cards: [card({ id: 'card-a' }), card({ id: 'card-b' })],
      roomProjects: [project({ id: 'project-1' })]
    }), 'project-1');
    const cardARowBefore = await rawObjectRow('card', 'card-a');
    commitCount = 0;

    const wrote = await commitCollectionRowChangesIfActive({
      changes: [{ type: 'delete', kind: 'card', id: 'card-b' }]
    });

    expect(wrote).toBe(true);
    expect((await rawObjectRow('card', 'card-b'))?.state).toBe('deleted');
    expect(await rawObjectRow('card', 'card-a')).toEqual(cardARowBefore);
    const meta = await readDomainMeta();
    expect(meta.objectCounts.card).toBe(1);
    expect(meta.totalObjectCount).toBe(2);
  });

  it('tombstones a non-active project and leaves the active pointer untouched', async () => {
    await promoteCollectionState(collectionState({
      roomProjects: [project({ id: 'project-1' }), project({ id: 'project-2' })]
    }), 'project-1');
    commitCount = 0;

    const wrote = await commitCollectionRowChangesIfActive({
      changes: [{ type: 'delete', kind: 'project', id: 'project-2' }]
    });

    expect(wrote).toBe(true);
    expect((await rawObjectRow('project', 'project-2'))?.state).toBe('deleted');
    const meta = await readDomainMeta();
    expect(meta.activeProjectId).toBe('project-1');
    expect(meta.objectCounts.project).toBe(1);
    expect(meta.totalObjectCount).toBe(1);
  });

  it('nulls the legacy active-project pointer when the active project is deleted', async () => {
    await promoteCollectionState(collectionState({
      roomProjects: [project({ id: 'project-1' }), project({ id: 'project-2' })]
    }), 'project-1');
    commitCount = 0;

    const wrote = await commitCollectionRowChangesIfActive({
      changes: [{ type: 'delete', kind: 'project', id: 'project-1' }]
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await rawObjectRow('project', 'project-1'))?.state).toBe('deleted');
    const meta = await readDomainMeta();
    // No guess at "the first surviving project"; the honest value is null.
    expect(meta.activeProjectId).toBeNull();
    expect(meta.objectCounts.project).toBe(1);
  });

  it('throws when a change set writes the same object twice', async () => {
    await promoteCollectionState(collectionState({
      cards: [card({ id: 'card-a' })],
      roomProjects: [project({ id: 'project-1' })]
    }), 'project-1');
    commitCount = 0;

    await expect(commitCollectionRowChangesIfActive({
      changes: [
        { type: 'upsert', kind: 'card', value: card({ id: 'card-a', title: 'edit' }) },
        { type: 'delete', kind: 'card', id: 'card-a' }
      ]
    })).rejects.toThrow(/same object twice/);
    expect(commitCount).toBe(0);
  });

  it('returns false without writing when the collection repository is inactive', async () => {
    const wrote = await commitCollectionRowChangesIfActive({
      changes: [{ type: 'upsert', kind: 'card', value: card({ id: 'card-a' }) }]
    });
    expect(wrote).toBe(false);
    expect(commitCount).toBe(0);
  });

  it('preserves the previous deletedBundledCardIds when none are supplied', async () => {
    await promoteCollectionState(collectionState({
      cards: [card({ id: 'card-a' })],
      roomProjects: [project({ id: 'project-1' })],
      deletedBundledCardIds: ['starter-card']
    }), 'project-1');
    commitCount = 0;

    await commitCollectionRowChangesIfActive({
      changes: [{ type: 'upsert', kind: 'card', value: card({ id: 'card-a', title: 'edit' }) }]
    });

    expect((await readDomainMeta()).deletedBundledCardIds).toEqual(['starter-card']);
  });

  it('commits a domain-meta-only change when deletedBundledCardIds changes with no object change', async () => {
    await promoteCollectionState(collectionState({
      cards: [card({ id: 'card-a' })],
      roomProjects: [project({ id: 'project-1' })],
      deletedBundledCardIds: ['starter-card']
    }), 'project-1');
    commitCount = 0;

    // No card/project/doc changed — only the deleted-bundled-card set grew. The value
    // diff over object rows is empty, but the domain-meta change must still be committed.
    const wrote = await commitCollectionRowChangesFromStateIfActive(collectionState({
      cards: [card({ id: 'card-a' })],
      roomProjects: [project({ id: 'project-1' })],
      deletedBundledCardIds: ['starter-card', 'another-bundled-card']
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readDomainMeta()).deletedBundledCardIds).toEqual(['another-bundled-card', 'starter-card']);
  });

  it('does not commit when nothing changed at all', async () => {
    await promoteCollectionState(collectionState({
      cards: [card({ id: 'card-a' })],
      roomProjects: [project({ id: 'project-1' })],
      deletedBundledCardIds: ['starter-card']
    }), 'project-1');
    commitCount = 0;

    const wrote = await commitCollectionRowChangesFromStateIfActive(collectionState({
      cards: [card({ id: 'card-a' })],
      roomProjects: [project({ id: 'project-1' })],
      deletedBundledCardIds: ['starter-card']
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(0);
  });
});
