import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Persona, PersonaMemoryReferenceDoc } from '../types/domain';
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
  clearStagedPersonaMemoryDocContent,
  docContentKey,
  PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX,
  PERSONA_MEMORY_DOC_CONTENT_PREFIX,
  readPersonaMemoryDocContent,
  stagePersonaMemoryDocDeletionForDoc,
  stagePersonaMemoryDocDeletionForPersona,
  writePersonaMemoryDocContentForPersonas
} from './personaMemoryReferenceDocPersistence';

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

function memoryDoc(patch: Partial<PersonaMemoryReferenceDoc> & Pick<PersonaMemoryReferenceDoc, 'id' | 'content'>): PersonaMemoryReferenceDoc {
  return {
    id: patch.id,
    title: patch.title ?? 'Doc',
    summary: patch.summary ?? 'summary',
    content: patch.content,
    source: patch.source ?? 'user',
    updatedAt: patch.updatedAt ?? 1,
    charCount: patch.charCount,
    contentLoaded: patch.contentLoaded
  };
}

function persona(id: string, referenceDocs: PersonaMemoryReferenceDoc[]): Persona {
  return { id, name: id, memory: { referenceDocs } } as unknown as Persona;
}

function documentBodyRow(personaId: string, docId: string) {
  return kvGet<LocalDataStoredRow<DocumentBodyRow>>(
    getLocalDataRowKey(getDocumentObjectLocalDataRef('persona-memory-doc', docContentKey(personaId, docId)))
  );
}

describe('persona memory doc bodies on the active document domain', () => {
  beforeEach(() => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
    clearStagedPersonaMemoryDocContent();
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
    clearStagedPersonaMemoryDocContent();
  });

  it('writes the body to a document row keyed by persona and doc, not the legacy chunked KV', async () => {
    await promoteEmptyDocumentDomain();

    await writePersonaMemoryDocContentForPersonas([
      persona('pharos', [memoryDoc({ id: 'doc-1', content: 'memory body', contentLoaded: true })])
    ]);

    const row = await documentBodyRow('pharos', 'doc-1');
    expect(row?.state).toBe('complete');
    expect((row as LocalDataStoredRow<DocumentBodyRow> & { value: DocumentBodyRow }).value.content).toBe('memory body');
    expect(await kvKeysWithPrefix(PERSONA_MEMORY_DOC_CONTENT_PREFIX)).toEqual([]);
    expect(await kvKeysWithPrefix(PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX)).toEqual([]);
  });

  it('reads an unloaded persona memory doc body back from its document row', async () => {
    await promoteEmptyDocumentDomain();
    await writePersonaMemoryDocContentForPersonas([
      persona('pharos', [memoryDoc({ id: 'doc-1', content: 'memory body', contentLoaded: true })])
    ]);

    const content = await readPersonaMemoryDocContent(
      'pharos',
      memoryDoc({ id: 'doc-1', content: '', charCount: 'memory body'.length, contentLoaded: false })
    );

    expect(content).toBe('memory body');
  });

  it('does not fall back to legacy KV when the active document row is missing', async () => {
    await promoteEmptyDocumentDomain();
    const bodyKey = docContentKey('pharos', 'doc-missing');
    await kvSet(`${PERSONA_MEMORY_DOC_CONTENT_PREFIX}${bodyKey}`, 'legacy body');

    await expect(readPersonaMemoryDocContent(
      'pharos',
      memoryDoc({ id: 'doc-missing', content: '', charCount: 'legacy body'.length, contentLoaded: false })
    )).rejects.toThrow('Persona memory document content is missing: pharos:doc-missing');
  });

  it('tombstones the body row when its doc is removed from a persona that is still present', async () => {
    await promoteEmptyDocumentDomain();
    await writePersonaMemoryDocContentForPersonas([
      persona('pharos', [
        memoryDoc({ id: 'doc-1', content: 'keep', contentLoaded: true }),
        memoryDoc({ id: 'doc-2', content: 'remove', contentLoaded: true })
      ])
    ]);

    await writePersonaMemoryDocContentForPersonas([
      persona('pharos', [memoryDoc({ id: 'doc-1', content: 'keep', contentLoaded: true })])
    ]);

    expect((await documentBodyRow('pharos', 'doc-1'))?.state).toBe('complete');
    expect((await documentBodyRow('pharos', 'doc-2'))?.state).toBe('deleted');
  });

  it('does NOT tombstone a body row whose persona is absent from the write (mere absence is not a delete)', async () => {
    await promoteEmptyDocumentDomain();
    await writePersonaMemoryDocContentForPersonas([
      persona('pharos', [memoryDoc({ id: 'doc-1', content: 'pharos body', contentLoaded: true })])
    ]);

    // A later save that does not include `pharos` at all — e.g. pharos is a sealed archive
    // persona outside the live list, or a partial/failed hydrate. Its body must survive,
    // because once the document domain owns bodies the old KV no longer backs them.
    await writePersonaMemoryDocContentForPersonas([
      persona('lyra', [memoryDoc({ id: 'doc-9', content: 'lyra body', contentLoaded: true })])
    ]);

    expect((await documentBodyRow('pharos', 'doc-1'))?.state).toBe('complete');
    expect((await documentBodyRow('lyra', 'doc-9'))?.state).toBe('complete');
  });

  it('does NOT tombstone any body row on an empty persona write', async () => {
    await promoteEmptyDocumentDomain();
    await writePersonaMemoryDocContentForPersonas([
      persona('pharos', [memoryDoc({ id: 'doc-1', content: 'pharos body', contentLoaded: true })])
    ]);

    await writePersonaMemoryDocContentForPersonas([]);

    expect((await documentBodyRow('pharos', 'doc-1'))?.state).toBe('complete');
  });

  it('tombstones an absent persona body ONLY through the explicit delete signal', async () => {
    await promoteEmptyDocumentDomain();
    await writePersonaMemoryDocContentForPersonas([
      persona('pharos', [
        memoryDoc({ id: 'doc-1', content: 'one', contentLoaded: true }),
        memoryDoc({ id: 'doc-2', content: 'two', contentLoaded: true })
      ]),
      persona('lyra', [memoryDoc({ id: 'doc-9', content: 'lyra body', contentLoaded: true })])
    ]);

    // pharos is explicitly deleted (now absent from the write); lyra is merely absent.
    stagePersonaMemoryDocDeletionForPersona('pharos');
    await writePersonaMemoryDocContentForPersonas([]);

    // Both pharos bodies removed through the explicit channel.
    expect((await documentBodyRow('pharos', 'doc-1'))?.state).toBe('deleted');
    expect((await documentBodyRow('pharos', 'doc-2'))?.state).toBe('deleted');
    // lyra was only absent, with no signal — its body survives.
    expect((await documentBodyRow('lyra', 'doc-9'))?.state).toBe('complete');
  });

  it('tombstones a single absent doc body through the explicit doc delete signal', async () => {
    await promoteEmptyDocumentDomain();
    await writePersonaMemoryDocContentForPersonas([
      persona('pharos', [
        memoryDoc({ id: 'doc-1', content: 'keep', contentLoaded: true }),
        memoryDoc({ id: 'doc-2', content: 'drop', contentLoaded: true })
      ])
    ]);

    stagePersonaMemoryDocDeletionForDoc('pharos', 'doc-2');
    await writePersonaMemoryDocContentForPersonas([]);

    expect((await documentBodyRow('pharos', 'doc-1'))?.state).toBe('complete');
    expect((await documentBodyRow('pharos', 'doc-2'))?.state).toBe('deleted');
  });
});
