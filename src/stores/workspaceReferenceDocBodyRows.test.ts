import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspaceReferenceDoc } from '../types/domain';
import {
  buildDocumentLocalDataUnitOfWork,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getDocumentObjectLocalDataRef,
  getLocalDataActiveDataSourceKey,
  getLocalDataRowKey,
  LOCAL_DATA_SCHEMA_VERSION,
  type DocumentBodyRow,
  type LocalDataActiveDataSourceRow,
  type LocalDataCommitMeta,
  type LocalDataStoredRow
} from '../engines/localData';
import {
  kvGet,
  kvKeysWithPrefix,
  kvSet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistedKvMutation,
  type PersistenceBackend
} from '../infrastructure/persistence';
import {
  clearStagedWorkspaceReferenceDocContent,
  readWorkspaceReferenceDocContent,
  WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX,
  WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX,
  writeWorkspaceReferenceDocContentForDocs
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

function activeSourceRow(meta: LocalDataCommitMeta): LocalDataActiveDataSourceRow {
  return {
    schemaVersion: LOCAL_DATA_SCHEMA_VERSION,
    key: getLocalDataActiveDataSourceKey(),
    activeDataSource: 'repository',
    activeCommitId: meta.commitId,
    stagingCommitId: null,
    updatedAt: meta.committedAt,
    domains: {
      document: { domain: 'document', version: meta.version, committedAt: meta.committedAt, commitId: meta.commitId }
    }
  };
}

async function promoteEmptyDocumentDomain() {
  const repository = createLocalDataRepository({
    backend: createLocalDataKvBackend(),
    now: () => 100,
    createCommitId: () => 'document:initial'
  });
  const meta = await repository.commit(buildDocumentLocalDataUnitOfWork({
    state: { documents: [] },
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 100
  }));
  await kvSet(getLocalDataActiveDataSourceKey(), activeSourceRow(meta));
}

function makeDoc(patch: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'id' | 'content'>): WorkspaceReferenceDoc {
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
    contentLoaded: patch.contentLoaded
  };
}

function documentBodyRow(id: string) {
  return kvGet<LocalDataStoredRow<DocumentBodyRow>>(
    getLocalDataRowKey(getDocumentObjectLocalDataRef('workspace-reference-doc', id))
  );
}

describe('workspace reference doc bodies on the active document domain', () => {
  beforeEach(() => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
    clearStagedWorkspaceReferenceDocContent();
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
    clearStagedWorkspaceReferenceDocContent();
  });

  it('writes the body to a document row and not the legacy chunked KV when the document domain is active', async () => {
    await promoteEmptyDocumentDomain();

    await writeWorkspaceReferenceDocContentForDocs([makeDoc({ id: 'doc-1', content: 'reference body', contentLoaded: true })]);

    const row = await documentBodyRow('doc-1');
    expect(row?.state).toBe('complete');
    expect((row as LocalDataStoredRow<DocumentBodyRow> & { value: DocumentBodyRow }).value.content).toBe('reference body');
    // The legacy chunked-KV body storage is left untouched (fallback only).
    expect(await kvKeysWithPrefix(WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX)).toEqual([]);
    expect(await kvKeysWithPrefix(WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX)).toEqual([]);
  });

  it('reads an unloaded doc body back from its document row', async () => {
    await promoteEmptyDocumentDomain();
    await writeWorkspaceReferenceDocContentForDocs([makeDoc({ id: 'doc-1', content: 'reference body', contentLoaded: true })]);

    const content = await readWorkspaceReferenceDocContent(
      makeDoc({ id: 'doc-1', content: '', charCount: 'reference body'.length, contentLoaded: false })
    );

    expect(content).toBe('reference body');
  });

  it('does not fall back to legacy KV when the active document row is missing', async () => {
    await promoteEmptyDocumentDomain();
    await kvSet(`${WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX}doc-missing`, 'legacy body');

    await expect(readWorkspaceReferenceDocContent(
      makeDoc({ id: 'doc-missing', content: '', charCount: 'legacy body'.length, contentLoaded: false })
    )).rejects.toThrow('Workspace reference document content is missing: doc-missing');
  });

  it('does NOT tombstone a body row when its doc is merely absent (no explicit delete signal)', async () => {
    await promoteEmptyDocumentDomain();
    await writeWorkspaceReferenceDocContentForDocs([
      makeDoc({ id: 'doc-1', content: 'keep', contentLoaded: true }),
      makeDoc({ id: 'doc-2', content: 'remove', contentLoaded: true })
    ]);

    // A workspace doc body has no per-owner sub-scope, so mere absence cannot authorize a
    // tombstone: doc-2 missing from this write leaves its body as a recoverable orphan.
    await writeWorkspaceReferenceDocContentForDocs([makeDoc({ id: 'doc-1', content: 'keep', contentLoaded: true })]);

    expect((await documentBodyRow('doc-1'))?.state).toBe('complete');
    expect((await documentBodyRow('doc-2'))?.state).toBe('complete');
  });

  it('tombstones a body row only when its id is named in the explicit delete signal', async () => {
    await promoteEmptyDocumentDomain();
    await writeWorkspaceReferenceDocContentForDocs([
      makeDoc({ id: 'doc-1', content: 'keep', contentLoaded: true }),
      makeDoc({ id: 'doc-2', content: 'remove', contentLoaded: true })
    ]);

    await writeWorkspaceReferenceDocContentForDocs(
      [makeDoc({ id: 'doc-1', content: 'keep', contentLoaded: true })],
      ['doc-2']
    );

    expect((await documentBodyRow('doc-1'))?.state).toBe('complete');
    expect((await documentBodyRow('doc-2'))?.state).toBe('deleted');
  });
});
