import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspaceReferenceDoc } from '../types/domain';
import {
  buildCollectionLocalDataUnitOfWork,
  buildDocumentLocalDataUnitOfWork,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getCollectionObjectLocalDataRef,
  getDocumentObjectLocalDataRef,
  getLocalDataActiveDataSourceKey,
  getLocalDataRowKey,
  LOCAL_DATA_SCHEMA_VERSION,
  type CollectionObjectRow,
  type DocumentBodyRow,
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
import { writeCollectionState, type PersistedCollectionState } from './collectionStorePersistence';
import {
  clearStagedWorkspaceReferenceDocContent,
  stageWorkspaceReferenceDocDeletion
} from './workspaceReferenceDocContentPersistence';

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

function workspaceDoc(patch: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'id' | 'content'>): WorkspaceReferenceDoc {
  return {
    id: patch.id,
    projectId: patch.projectId ?? 'project-1',
    title: patch.title ?? 'Reference',
    summary: patch.summary ?? 'summary',
    content: patch.content,
    source: patch.source ?? 'manual',
    createdAt: patch.createdAt ?? 1,
    updatedAt: patch.updatedAt ?? 1,
    charCount: patch.charCount,
    contentLoaded: patch.contentLoaded ?? true
  };
}

function activeSourceRow(collectionMeta: LocalDataCommitMeta, documentMeta: LocalDataCommitMeta): LocalDataActiveDataSourceRow {
  return {
    schemaVersion: LOCAL_DATA_SCHEMA_VERSION,
    key: getLocalDataActiveDataSourceKey(),
    activeDataSource: 'repository',
    activeCommitId: documentMeta.commitId,
    stagingCommitId: null,
    updatedAt: documentMeta.committedAt,
    domains: {
      collection: {
        domain: 'collection',
        version: collectionMeta.version,
        committedAt: collectionMeta.committedAt,
        commitId: collectionMeta.commitId
      },
      document: {
        domain: 'document',
        version: documentMeta.version,
        committedAt: documentMeta.committedAt,
        commitId: documentMeta.commitId
      }
    }
  };
}

async function promoteCollectionAndDocument() {
  const repository = createLocalDataRepository({
    backend: createLocalDataKvBackend(),
    now: () => 100,
    createCommitId: (unit) => `${unit.domain}:initial`
  });
  const collectionMeta = await repository.commit(buildCollectionLocalDataUnitOfWork({
    activeProjectId: null,
    state: { cards: [], imageCards: [], roomProjects: [], projectFiles: [], workspaceReferenceDocs: [] },
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 100
  }));
  const documentMeta = await repository.commit(buildDocumentLocalDataUnitOfWork({
    state: { documents: [] },
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 100
  }));
  await kvSet(getLocalDataActiveDataSourceKey(), activeSourceRow(collectionMeta, documentMeta));
}

function collectionDirectoryRow(id: string) {
  return kvGet<LocalDataStoredRow<CollectionObjectRow<'workspace-doc'>>>(
    getLocalDataRowKey(getCollectionObjectLocalDataRef('workspace-doc', id))
  );
}

function documentBodyRow(id: string) {
  return kvGet<LocalDataStoredRow<DocumentBodyRow>>(
    getLocalDataRowKey(getDocumentObjectLocalDataRef('workspace-reference-doc', id))
  );
}

describe('workspace doc directory + body owners in one collection save path', () => {
  beforeEach(() => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
    clearStagedWorkspaceReferenceDocContent();
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
    clearStagedWorkspaceReferenceDocContent();
  });

  it('writes the workspace-doc directory row to collection and the body row to document', async () => {
    await promoteCollectionAndDocument();

    await writeCollectionState(collectionState({
      workspaceReferenceDocs: [workspaceDoc({ id: 'doc-1', content: 'reference body', title: 'Ref', summary: 'sum' })]
    }));

    // collection owns the directory row
    const directory = await collectionDirectoryRow('doc-1');
    expect(directory?.state).toBe('complete');
    expect((directory as LocalDataStoredRow<CollectionObjectRow<'workspace-doc'>> & { value: CollectionObjectRow<'workspace-doc'> }).value.value.title).toBe('Ref');

    // document owns the body row
    const body = await documentBodyRow('doc-1');
    expect(body?.state).toBe('complete');
    expect((body as LocalDataStoredRow<DocumentBodyRow> & { value: DocumentBodyRow }).value.content).toBe('reference body');
  });

  it('keeps the document body as a recoverable orphan when the doc is merely absent (no explicit delete)', async () => {
    await promoteCollectionAndDocument();
    await writeCollectionState(collectionState({
      workspaceReferenceDocs: [workspaceDoc({ id: 'doc-1', content: 'reference body' })]
    }));

    // A save whose workspace-doc list simply does not include doc-1 — e.g. a partial write or
    // a not-yet-recovered archive — carries no explicit delete signal.
    await writeCollectionState(collectionState({ workspaceReferenceDocs: [] }));

    // The collection domain reconciles its OWN directory rows against its full-list truth.
    expect((await collectionDirectoryRow('doc-1'))?.state).toBe('deleted');
    // The document body is a separate domain's fact: mere absence must NOT tombstone it, so it
    // survives as a recoverable orphan (body present + head missing) rather than being
    // destroyed irreversibly.
    expect((await documentBodyRow('doc-1'))?.state).toBe('complete');
  });

  it('tombstones both the directory row and the document body row on an explicit workspace doc delete', async () => {
    await promoteCollectionAndDocument();
    await writeCollectionState(collectionState({
      workspaceReferenceDocs: [workspaceDoc({ id: 'doc-1', content: 'reference body' })]
    }));

    // The explicit delete action stages the body deletion; the next save removes the doc from
    // the list AND carries the staged signal.
    stageWorkspaceReferenceDocDeletion('doc-1');
    await writeCollectionState(collectionState({ workspaceReferenceDocs: [] }));

    expect((await collectionDirectoryRow('doc-1'))?.state).toBe('deleted');
    expect((await documentBodyRow('doc-1'))?.state).toBe('deleted');
  });
});
