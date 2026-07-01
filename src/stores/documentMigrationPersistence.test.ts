import { afterEach, describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../config/persona/personaBuilder';
import type { WorkspaceReferenceDoc } from '../types/domain';
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
  getDocumentObjectLocalDataRef,
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  type CommitPointerRow,
  type DocumentBodyRow,
  type LocalDataCompleteRow,
  type LocalDataIncompleteRow
} from '../engines/localData';
import { docContentKey, PERSONA_MEMORY_DOC_CONTENT_PREFIX } from './personaMemoryReferenceDocPersistence';
import {
  WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX,
  WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX
} from './workspaceReferenceDocContentPersistence';
import { commitDocumentRowsMigrationFromCurrentPersistence } from './documentMigrationPersistence';

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

function workspaceDoc(seed: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'id' | 'projectId'>): WorkspaceReferenceDoc {
  return {
    title: seed.id,
    summary: '',
    content: '',
    charCount: 0,
    contentLoaded: false,
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...seed
  };
}

afterEach(() => {
  setPersistenceBackendForTesting(null);
});

describe('commitDocumentRowsMigrationFromCurrentPersistence', () => {
  it('commits persona and workspace document body rows without promoting activeDataSource', async () => {
    const personaDocKey = docContentKey('pharos', 'memory-doc-1');
    const persona = createPersonaTemplate({
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
          id: 'memory-doc-1',
          title: 'Memory',
          summary: 'summary',
          content: '',
          charCount: 11,
          contentLoaded: false,
          source: 'user',
          updatedAt: 20
        }]
      }
    });
    const referenceDoc = workspaceDoc({
      id: 'workspace-doc-1',
      projectId: 'project-1',
      title: 'Workspace',
      summary: 'workspace summary',
      charCount: 14,
      ownerCollaboratorId: 'pharos',
      updatedAt: 30
    });
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        {
          key: 'persona-state-v2',
          value: {
            personas: [persona],
            activeCollaboratorId: 'pharos',
            seededDefaultPersonaIds: ['polaris-assistant']
          }
        },
        {
          key: 'collection-state-v2',
          value: {
            cards: [],
            imageCards: [],
            roomProjects: [],
            projectFiles: [],
            workspaceReferenceDocs: [referenceDoc]
          }
        },
        {
          key: `${PERSONA_MEMORY_DOC_CONTENT_PREFIX}${personaDocKey}`,
          value: 'memory body'
        },
        {
          key: `${WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX}workspace-doc-1`,
          value: 'workspace body'
        }
      ]
    }));

    const result = await commitDocumentRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'document-rows-test'
    });

    const personaDocRow = await kvGet<LocalDataCompleteRow<DocumentBodyRow>>(
      getLocalDataRowKey(getDocumentObjectLocalDataRef('persona-memory-doc', personaDocKey))
    );
    const workspaceDocRow = await kvGet<LocalDataCompleteRow<DocumentBodyRow>>(
      getLocalDataRowKey(getDocumentObjectLocalDataRef('workspace-reference-doc', 'workspace-doc-1'))
    );
    const pointer = await kvGet<CommitPointerRow>(getLocalDataCommitPointerKey('document'));
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    expect(result.commitMeta).toEqual({
      domain: 'document',
      version: 7,
      committedAt: 100,
      commitId: 'document-rows-test'
    });
    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 2,
      projectedObjectCount: 2,
      missingBodyCount: 0,
      incompleteChunkCount: 0,
      orphanBodyCount: 0,
      expectedRepositoryRowCount: 3,
      actualRepositoryRowCount: 3,
      blockers: [],
      warnings: []
    }));
    expect(personaDocRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        id: personaDocKey,
        kind: 'persona-memory-doc',
        content: 'memory body',
        actualCharCount: 11,
        storageSource: 'split',
        ownerRefs: [{ kind: 'persona', id: 'pharos', label: 'Pharos' }]
      })
    }));
    expect(workspaceDocRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        id: 'workspace-doc-1',
        kind: 'workspace-reference-doc',
        content: 'workspace body',
        actualCharCount: 14,
        storageSource: 'split',
        ownerRefs: [{ kind: 'workspace-doc', id: 'workspace-doc-1', label: 'Workspace' }]
      })
    }));
    expect(pointer).toEqual({
      domain: 'document',
      version: 7,
      committedAt: 100,
      commitId: 'document-rows-test'
    });
    expect(activeDataSource).toBeNull();
  });

  it('quarantines chunked document bodies that are shorter than the directory contract', async () => {
    const referenceDoc = workspaceDoc({
      id: 'workspace-doc-tail-missing',
      projectId: 'project-1',
      title: 'Workspace tail',
      summary: 'tail summary',
      charCount: 11,
      ownerCollaboratorId: 'pharos',
      updatedAt: 30
    });
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        {
          key: 'collection-state-v2',
          value: {
            cards: [],
            imageCards: [],
            roomProjects: [],
            projectFiles: [],
            workspaceReferenceDocs: [referenceDoc]
          }
        },
        {
          key: `${WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX}workspace-doc-tail-missing:0`,
          value: 'hello '
        }
      ]
    }));

    const result = await commitDocumentRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'document-rows-tail-missing-test'
    });

    const workspaceDocRow = await kvGet<LocalDataIncompleteRow>(
      getLocalDataRowKey(getDocumentObjectLocalDataRef('workspace-reference-doc', 'workspace-doc-tail-missing'))
    );

    expect(result.census).toEqual(expect.objectContaining({
      ok: false,
      sourceObjectCount: 1,
      projectedObjectCount: 1,
      missingBodyCount: 0,
      incompleteChunkCount: 1,
      blockers: ['document:missing-body']
    }));
    expect(workspaceDocRow).toEqual(expect.objectContaining({
      state: 'incomplete',
      reason: 'missing-chunk',
      missingKeys: ['workspace-reference-doc-content-v2:workspace-doc-tail-missing:0'],
      meta: expect.objectContaining({
        actualCharCount: 0,
        assetRefs: [],
        chunkCount: 1,
        chunkIndexes: [0],
        content: '',
        contentLoaded: false,
        declaredCharCount: 11,
        storageSource: 'chunked'
      })
    }));
  });
});
