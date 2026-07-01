import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../config/persona/personaBuilder';
import {
  buildPersonaLocalDataUnitOfWork,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getLocalDataActiveDataSourceKey,
  getLocalDataRowKey,
  getPersonaDomainMetaLocalDataRef,
  getPersonaObjectLocalDataRef,
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataActiveDataSourceRow,
  type LocalDataCommitMeta,
  type LocalDataStoredRow,
  type PersonaDomainMetaRow,
  type PersonaObjectRow
} from '../engines/localData';
import {
  kvGet,
  kvSet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistedKvMutation,
  type PersistenceBackend
} from '../infrastructure/persistence';
import type { Persona } from '../types/domain';
import {
  commitPersonaRowChangesFromStateIfActive,
  commitPersonaRowChangesIfActive
} from './personaLocalDataPersistence';

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

function persona(
  id: string,
  overrides: { content?: string; description?: string; version?: number } = {}
): Persona {
  return createPersonaTemplate({
    id,
    name: id,
    description: overrides.description ?? '',
    version: overrides.version,
    memory: {
      inheritGlobal: true,
      crossConversationRecallEnabled: true,
      conversationSummaries: [],
      excludedGlobalIds: [],
      personalMemories: [],
      referenceDocs: overrides.content
        ? [{
            id: 'doc-1',
            title: 'Doc',
            summary: '',
            content: overrides.content,
            charCount: overrides.content.length,
            contentLoaded: true,
            source: 'upload',
            updatedAt: 1
          }]
        : []
    }
  });
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
      persona: {
        domain: 'persona',
        version: meta.version,
        committedAt: meta.committedAt,
        commitId: meta.commitId
      }
    }
  };
}

async function promotePersonaState(args: {
  personas: Persona[];
  activeCollaboratorId: string | null;
  seededDefaultPersonaIds?: string[];
}) {
  const repository = createLocalDataRepository({
    backend: createLocalDataKvBackend(),
    now: () => 100,
    createCommitId: () => 'persona:initial'
  });
  const meta = await repository.commit(buildPersonaLocalDataUnitOfWork({
    state: {
      personas: args.personas,
      activeCollaboratorId: args.activeCollaboratorId,
      seededDefaultPersonaIds: args.seededDefaultPersonaIds ?? []
    },
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 100
  }));
  await kvSet(getLocalDataActiveDataSourceKey(), activeSourceRow(meta));
}

function rawObjectRow(id: string) {
  return kvGet<LocalDataStoredRow<PersonaObjectRow>>(
    getLocalDataRowKey(getPersonaObjectLocalDataRef(id))
  );
}

async function readObjectValue(id: string) {
  const row = await rawObjectRow(id);
  if (!row || row.state !== 'complete') throw new Error(`collaborator:${id} is not complete`);
  return row.value;
}

async function readDomainMeta() {
  const row = await kvGet<LocalDataStoredRow<PersonaDomainMetaRow>>(
    getLocalDataRowKey(getPersonaDomainMetaLocalDataRef())
  );
  if (!row || row.state !== 'complete') throw new Error('persona domain meta is not complete');
  return row.value;
}

describe('persona row writer', () => {
  beforeEach(() => {
    commitCount = 0;
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  it('upserts one collaborator without rewriting unrelated rows', async () => {
    await promotePersonaState({
      personas: [persona('persona-a'), persona('persona-b')],
      activeCollaboratorId: 'persona-a'
    });
    const rowABefore = await rawObjectRow('persona-a');
    commitCount = 0;

    const wrote = await commitPersonaRowChangesIfActive({
      changes: [{ type: 'upsert', value: persona('persona-b', { description: 'edited' }) }],
      activeCollaboratorId: 'persona-a',
      seededDefaultPersonaIds: []
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readObjectValue('persona-b')).value).toEqual(expect.objectContaining({ description: 'edited' }));
    // persona-a untouched, byte-for-byte.
    expect(await rawObjectRow('persona-a')).toEqual(rowABefore);
    const meta = await readDomainMeta();
    expect(meta.totalObjectCount).toBe(2);
    expect(meta.activeObjectCount).toBe(2);
    expect(meta.activeCollaboratorId).toBe('persona-a');
  });

  it('writes the directory row with the memory document body stripped', async () => {
    await promotePersonaState({ personas: [persona('persona-a')], activeCollaboratorId: 'persona-a' });
    commitCount = 0;

    const wrote = await commitPersonaRowChangesFromStateIfActive({
      personas: [persona('persona-a', { content: 'loaded body text' })],
      activeCollaboratorId: 'persona-a',
      seededDefaultPersonaIds: []
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    // The body is the document domain's fact; the collaborator directory row never
    // carries it back inline.
    const doc = (await readObjectValue('persona-a')).value.memory.referenceDocs[0];
    expect(doc).toEqual(expect.objectContaining({
      id: 'doc-1',
      content: '',
      contentLoaded: false,
      charCount: 'loaded body text'.length
    }));
  });

  it('strips the memory body on a direct targeted upsert, not only on the value-diff path', async () => {
    await promotePersonaState({ personas: [persona('persona-a')], activeCollaboratorId: 'persona-a' });
    commitCount = 0;

    // Hand the writer primitive a persona that still has a loaded body. The contract is
    // that the collaborator row never carries the body, and the primitive enforces it
    // itself — a caller does not have to remember to strip first.
    const wrote = await commitPersonaRowChangesIfActive({
      changes: [{ type: 'upsert', value: persona('persona-a', { content: 'loaded body text' }) }],
      activeCollaboratorId: 'persona-a',
      seededDefaultPersonaIds: []
    });

    expect(wrote).toBe(true);
    const doc = (await readObjectValue('persona-a')).value.memory.referenceDocs[0];
    expect(doc).toEqual(expect.objectContaining({
      id: 'doc-1',
      content: '',
      contentLoaded: false,
      charCount: 'loaded body text'.length
    }));
  });

  it('tombstones a removed collaborator and drops it from the counts', async () => {
    await promotePersonaState({
      personas: [persona('persona-a'), persona('persona-b')],
      activeCollaboratorId: 'persona-a'
    });
    const rowABefore = await rawObjectRow('persona-a');
    commitCount = 0;

    const wrote = await commitPersonaRowChangesFromStateIfActive({
      personas: [persona('persona-a')],
      activeCollaboratorId: 'persona-a',
      seededDefaultPersonaIds: []
    });

    expect(wrote).toBe(true);
    expect((await rawObjectRow('persona-b'))?.state).toBe('deleted');
    expect(await rawObjectRow('persona-a')).toEqual(rowABefore);
    const meta = await readDomainMeta();
    expect(meta.totalObjectCount).toBe(1);
  });

  it('records the active-collaborator pointer flip and re-flags both rows', async () => {
    await promotePersonaState({
      personas: [persona('persona-a'), persona('persona-b')],
      activeCollaboratorId: 'persona-a'
    });
    commitCount = 0;

    const wrote = await commitPersonaRowChangesFromStateIfActive({
      personas: [persona('persona-a'), persona('persona-b')],
      activeCollaboratorId: 'persona-b',
      seededDefaultPersonaIds: []
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readObjectValue('persona-a')).active).toBe(false);
    expect((await readObjectValue('persona-b')).active).toBe(true);
    expect((await readDomainMeta()).activeCollaboratorId).toBe('persona-b');
  });

  it('commits a domain-meta-only change when seededDefaultPersonaIds changes with no row change', async () => {
    await promotePersonaState({
      personas: [persona('persona-a')],
      activeCollaboratorId: 'persona-a',
      seededDefaultPersonaIds: ['persona-a']
    });
    commitCount = 0;

    const wrote = await commitPersonaRowChangesFromStateIfActive({
      personas: [persona('persona-a')],
      activeCollaboratorId: 'persona-a',
      seededDefaultPersonaIds: ['persona-a', 'polaris-assistant']
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readDomainMeta()).seededDefaultPersonaIds).toEqual(['persona-a', 'polaris-assistant']);
  });

  it('treats a freshly migrated inline-body row as a no-op when the directory is unchanged', async () => {
    // The migration restores the memory body inline for self-contained hydration; the
    // save path strips it. An unchanged directory whose body merely lives inline must
    // not be rewritten.
    await promotePersonaState({
      personas: [persona('persona-a', { content: 'inline body' })],
      activeCollaboratorId: 'persona-a'
    });
    commitCount = 0;

    const wrote = await commitPersonaRowChangesFromStateIfActive({
      personas: [persona('persona-a', { content: 'inline body' })],
      activeCollaboratorId: 'persona-a',
      seededDefaultPersonaIds: []
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(0);
  });

  it('throws when a change set writes the same collaborator twice', async () => {
    await promotePersonaState({ personas: [persona('persona-a')], activeCollaboratorId: 'persona-a' });
    commitCount = 0;

    await expect(commitPersonaRowChangesIfActive({
      changes: [
        { type: 'upsert', value: persona('persona-a', { description: 'edit' }) },
        { type: 'delete', id: 'persona-a' }
      ],
      activeCollaboratorId: 'persona-a',
      seededDefaultPersonaIds: []
    })).rejects.toThrow(/same collaborator twice/);
    expect(commitCount).toBe(0);
  });

  it('returns false without writing when the persona repository is inactive', async () => {
    const wrote = await commitPersonaRowChangesIfActive({
      changes: [{ type: 'upsert', value: persona('persona-a') }],
      activeCollaboratorId: 'persona-a',
      seededDefaultPersonaIds: []
    });
    expect(wrote).toBe(false);
    expect(commitCount).toBe(0);
  });
});
