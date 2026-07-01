import { afterEach, describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../config/persona/personaBuilder';
import {
  ASSET_BINARY_STORE,
  ASSET_META_STORE,
  ASSET_PREVIEW_STORE,
  KV_STORE,
  kvGet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistenceBackend
} from '../infrastructure/persistence';
import {
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  getPersonaDomainMetaLocalDataRef,
  getPersonaObjectLocalDataRef,
  type CommitPointerRow,
  type PersonaDomainMetaRow,
  type LocalDataCompleteRow,
  type PersonaObjectRow
} from '../engines/localData';
import {
  docContentKey,
  PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX,
  PERSONA_MEMORY_DOC_CONTENT_PREFIX
} from './personaMemoryReferenceDocPersistence';
import { commitPersonaRowsMigrationFromCurrentPersistence } from './personaMigrationPersistence';

function createMemoryPersistenceBackend(args: {
  kv?: PersistedDbEntry[];
} = {}): PersistenceBackend {
  const stores = new Map<string, Map<string, unknown>>([
    [KV_STORE, new Map((args.kv ?? []).map((entry) => [entry.key, entry.value]))],
    [ASSET_BINARY_STORE, new Map()],
    [ASSET_META_STORE, new Map()],
    [ASSET_PREVIEW_STORE, new Map()]
  ]);
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
    async dbStoreClear(storeName: string) {
      getStore(storeName).clear();
    },
    async kvApplyMutations(mutations) {
      const kv = getStore(KV_STORE);
      mutations.forEach((mutation) => {
        if (mutation.type === 'set') kv.set(mutation.key, mutation.value);
        else kv.delete(mutation.key);
      });
    },
    async kvReplaceAll(entries) {
      stores.set(KV_STORE, new Map(entries.map((entry) => [entry.key, entry.value])));
    }
  };
}

afterEach(() => {
  setPersistenceBackendForTesting(null);
});

describe('commitPersonaRowsMigrationFromCurrentPersistence', () => {
  it('commits restored persona rows from current persistence without promoting activeDataSource', async () => {
    const docKey = docContentKey('pharos', 'doc-1');
    const strippedPersona = createPersonaTemplate({
      id: 'pharos',
      name: 'Pharos',
      description: '',
      memory: {
        inheritGlobal: true,
        crossConversationRecallEnabled: true,
        conversationSummaries: [],
        excludedGlobalIds: [],
        personalMemories: [],
        referenceDocs: [{
          id: 'doc-1',
          title: 'Reference',
          summary: 'summary',
          content: '',
          charCount: 13,
          contentLoaded: false,
          source: 'user',
          updatedAt: 20
        }]
      }
    });
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        {
          key: 'persona-state-v2',
          value: {
            personas: [strippedPersona],
            activeCollaboratorId: 'pharos',
            seededDefaultPersonaIds: ['polaris-assistant']
          }
        },
        {
          key: `${PERSONA_MEMORY_DOC_CONTENT_PREFIX}${docKey}`,
          value: 'restored body'
        }
      ]
    }));

    const result = await commitPersonaRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'persona-rows-test'
    });

    const personaRow = await kvGet<LocalDataCompleteRow<PersonaObjectRow>>(
      getLocalDataRowKey(getPersonaObjectLocalDataRef('pharos'))
    );
    const pointer = await kvGet<CommitPointerRow>(getLocalDataCommitPointerKey('persona'));
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    expect(result.commitMeta).toEqual({
      domain: 'persona',
      version: 7,
      committedAt: 100,
      commitId: 'persona-rows-test'
    });
    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 1,
      projectedObjectCount: 1,
      expectedRepositoryRowCount: 2,
      actualRepositoryRowCount: 2,
      blockers: [],
      warnings: []
    }));
    expect(personaRow).toEqual(expect.objectContaining({
        state: 'complete',
      value: expect.objectContaining({
        objectId: 'collaborator:pharos',
        active: true,
        assetRefs: [],
        value: expect.objectContaining({
          memory: expect.objectContaining({
            referenceDocs: [expect.objectContaining({
              id: 'doc-1',
              content: 'restored body',
              contentLoaded: true
            })]
          })
        })
      })
    }));
    expect(pointer).toEqual({
      domain: 'persona',
      version: 7,
      committedAt: 100,
      commitId: 'persona-rows-test'
    });
    expect(activeDataSource).toBeNull();
  });

  it('ignores broken orphan memory doc chunks while restoring current persona docs', async () => {
    const docKey = docContentKey('pharos', 'doc-1');
    const strippedPersona = createPersonaTemplate({
      id: 'pharos',
      name: 'Pharos',
      description: '',
      memory: {
        inheritGlobal: true,
        crossConversationRecallEnabled: true,
        conversationSummaries: [],
        excludedGlobalIds: [],
        personalMemories: [],
        referenceDocs: [{
          id: 'doc-1',
          title: 'Reference',
          summary: 'summary',
          content: '',
          charCount: 13,
          contentLoaded: false,
          source: 'user',
          updatedAt: 20
        }]
      }
    });
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        {
          key: 'persona-state-v2',
          value: {
            personas: [strippedPersona],
            activeCollaboratorId: 'pharos',
            seededDefaultPersonaIds: ['polaris-assistant']
          }
        },
        {
          key: `${PERSONA_MEMORY_DOC_CONTENT_PREFIX}${docKey}`,
          value: 'restored body'
        },
        {
          key: `${PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX}${docContentKey('stale-persona', 'stale-doc')}:1`,
          value: 'orphan partial chunk'
        }
      ]
    }));

    const result = await commitPersonaRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'persona-orphan-doc-chunk-test'
    });

    const personaRow = await kvGet<LocalDataCompleteRow<PersonaObjectRow>>(
      getLocalDataRowKey(getPersonaObjectLocalDataRef('pharos'))
    );

    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      blockers: [],
      warnings: []
    }));
    expect(personaRow?.value.value.memory.referenceDocs).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        content: 'restored body',
        contentLoaded: true
      })
    ]);
  });

  it('keeps unrecoverable reference doc directories instead of treating missing bodies as deletion truth', async () => {
    const strippedPersona = createPersonaTemplate({
      id: 'pharos',
      name: 'Pharos',
      description: '',
      memory: {
        inheritGlobal: true,
        crossConversationRecallEnabled: true,
        conversationSummaries: [],
        excludedGlobalIds: [],
        personalMemories: [],
        referenceDocs: [{
          id: 'doc-1',
          title: 'Reference',
          summary: 'summary',
          content: '',
          charCount: 13,
          contentLoaded: false,
          source: 'user',
          updatedAt: 20
        }]
      }
    });
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [{
        key: 'persona-state-v2',
        value: {
          personas: [strippedPersona],
          activeCollaboratorId: 'pharos',
          seededDefaultPersonaIds: ['polaris-assistant']
        }
      }]
    }));

    const result = await commitPersonaRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'persona-rows-missing-doc-test'
    });
    const personaRow = await kvGet<LocalDataCompleteRow<PersonaObjectRow>>(
      getLocalDataRowKey(getPersonaObjectLocalDataRef('pharos'))
    );

    expect(result.census).toEqual(expect.objectContaining({
      ok: false,
      sourceObjectCount: 1,
      projectedObjectCount: 1,
      expectedRepositoryRowCount: 2,
      actualRepositoryRowCount: 2,
      blockers: ['persona:missing-body']
    }));
    expect(personaRow?.value.value.memory.referenceDocs).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        content: '',
        charCount: 13,
        contentLoaded: false
      })
    ]);
    expect(await kvGet(getLocalDataCommitPointerKey('persona'))).toEqual(expect.objectContaining({
      domain: 'persona',
      commitId: 'persona-rows-missing-doc-test'
    }));
    expect(await kvGet(getLocalDataActiveDataSourceKey())).toBeNull();
  });

  it('repairs dangling active collaborator and restores split docs from odd persona payloads', async () => {
    const oddPersona = createPersonaTemplate({
      id: 'nova',
      name: '  ',
      description: '',
      memory: {
        inheritGlobal: true,
        crossConversationRecallEnabled: true,
        conversationSummaries: [],
        excludedGlobalIds: [],
        personalMemories: [],
        referenceDocs: [{
          id: 'doc-odd',
          title: 'Odd doc',
          summary: '',
          content: '',
          charCount: 13,
          contentLoaded: false,
          source: 'user',
          updatedAt: Number.NaN
        }]
      },
      version: Number.NaN
    });
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        {
          key: 'persona-state-v2',
          value: {
            personas: [oddPersona],
            activeCollaboratorId: 'missing-collaborator',
            seededDefaultPersonaIds: ['polaris-assistant', '', 'polaris-assistant']
          }
        },
        {
          key: `${PERSONA_MEMORY_DOC_CONTENT_PREFIX}${docContentKey('nova', 'doc-odd')}`,
          value: 'restored body'
        }
      ]
    }));

    const result = await commitPersonaRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'persona-odd-shapes-test'
    });

    const domainMetaRow = await kvGet<LocalDataCompleteRow<PersonaDomainMetaRow>>(
      getLocalDataRowKey(getPersonaDomainMetaLocalDataRef())
    );
    const personaRow = await kvGet<LocalDataCompleteRow<PersonaObjectRow>>(
      getLocalDataRowKey(getPersonaObjectLocalDataRef('nova'))
    );
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    expect(result.census).toEqual(expect.objectContaining({
      ok: false,
      sourceObjectCount: 1,
      projectedObjectCount: 1,
      expectedRepositoryRowCount: 2,
      actualRepositoryRowCount: 2,
      blockers: ['persona:metadata-issue']
    }));
    expect(domainMetaRow?.value).toEqual(expect.objectContaining({
      activeCollaboratorId: 'nova',
      seededDefaultPersonaIds: ['polaris-assistant']
    }));
    expect(personaRow?.value).toEqual(expect.objectContaining({
      objectId: 'collaborator:nova',
      active: true,
      value: expect.objectContaining({
        memory: expect.objectContaining({
          referenceDocs: [expect.objectContaining({
            id: 'doc-odd',
            content: 'restored body',
            contentLoaded: true
          })]
        })
      })
    }));
    expect(activeDataSource).toBeNull();
  });
});
