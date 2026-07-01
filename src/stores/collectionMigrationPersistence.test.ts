import { afterEach, describe, expect, it } from 'vitest';
import type { CodeCard, ProjectFile, RoomProject } from '../types/domain';
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
  getCollectionObjectLocalDataRef,
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  type CollectionObjectRow,
  type CommitPointerRow,
  type LocalDataCompleteRow
} from '../engines/localData';
import { commitCollectionRowsMigrationFromCurrentPersistence } from './collectionMigrationPersistence';
import {
  WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX,
  workspaceReferenceDocContentKey
} from './workspaceReferenceDocContentPersistence';

function createMemoryPersistenceBackend(args: {
  kv?: PersistedDbEntry[];
  assetMeta?: PersistedDbEntry[];
  assetBinary?: PersistedDbEntry[];
  assetPreview?: PersistedDbEntry[];
} = {}): PersistenceBackend {
  const stores = new Map<string, Map<string, unknown>>([
    [KV_STORE, new Map((args.kv ?? []).map((entry) => [entry.key, entry.value]))],
    [ASSET_BINARY_STORE, new Map((args.assetBinary ?? []).map((entry) => [entry.key, entry.value]))],
    [ASSET_META_STORE, new Map((args.assetMeta ?? []).map((entry) => [entry.key, entry.value]))],
    [ASSET_PREVIEW_STORE, new Map((args.assetPreview ?? []).map((entry) => [entry.key, entry.value]))]
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

function card(seed: Partial<CodeCard> & Pick<CodeCard, 'id'>): CodeCard {
  return {
    title: seed.id,
    language: 'html',
    code: '',
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...seed
  };
}

function project(seed: Partial<RoomProject> & Pick<RoomProject, 'id'>): RoomProject {
  return {
    title: seed.id,
    slug: seed.id,
    fileIds: [],
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    pinnedAt: null,
    ...seed
  };
}

function file(seed: Partial<ProjectFile> & Pick<ProjectFile, 'id' | 'projectId'>): ProjectFile {
  return {
    filePath: 'index.html',
    language: 'html',
    content: '',
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...seed
  };
}

afterEach(() => {
  setPersistenceBackendForTesting(null);
});

describe('commitCollectionRowsMigrationFromCurrentPersistence', () => {
  it('commits collection rows from current persistence without promoting activeDataSource', async () => {
    const currentCard = card({ id: 'card-1', ownerCollaboratorId: 'pharos' });
    const currentProject = project({ id: 'project-1', ownerCollaboratorId: 'pharos' });
    const currentFile = file({ id: 'file-1', projectId: 'project-1', ownerCollaboratorId: 'pharos' });
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        {
          key: 'collection-state-v2',
          value: {
            cards: [currentCard],
            imageCards: [],
            roomProjects: [currentProject],
            projectFiles: [currentFile],
            workspaceReferenceDocs: []
          }
        },
        {
          key: 'space-theme-state-v1',
          value: { collectionProjectId: 'project-1' }
        },
        {
          key: 'persona-state-v2',
          value: { personas: [{ id: 'pharos' }], activeCollaboratorId: 'pharos' }
        }
      ]
    }));

    const result = await commitCollectionRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'collection-rows-test'
    });

    const cardRow = await kvGet<LocalDataCompleteRow<CollectionObjectRow>>(
      getLocalDataRowKey(getCollectionObjectLocalDataRef('card', currentCard.id))
    );
    const fileRow = await kvGet<LocalDataCompleteRow<CollectionObjectRow>>(
      getLocalDataRowKey(getCollectionObjectLocalDataRef('project-file', currentFile.id))
    );
    const pointer = await kvGet<CommitPointerRow>(getLocalDataCommitPointerKey('collection'));
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    expect(result.commitMeta).toEqual({
      domain: 'collection',
      version: 7,
      committedAt: 100,
      commitId: 'collection-rows-test'
    });
    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 3,
      projectedObjectCount: 3,
      recoveredProjectCount: 0,
      expectedRepositoryRowCount: 4,
      actualRepositoryRowCount: 4
    }));
    expect(cardRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        objectId: 'card:card-1',
        value: expect.objectContaining({
          ...currentCard,
          kind: 'card',
          pinnedAt: null
        })
      })
    }));
    expect(fileRow?.value).toEqual(expect.objectContaining({
      objectId: 'project-file:file-1',
      projectId: 'project-1'
    }));
    expect(pointer).toEqual({
      domain: 'collection',
      version: 7,
      committedAt: 100,
      commitId: 'collection-rows-test'
    });
    expect(activeDataSource).toBeNull();
  });

  it('repairs missing project shells before committing rows', async () => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [{
        key: 'collection-state-v2',
        value: {
          cards: [],
          imageCards: [],
          roomProjects: [],
          projectFiles: [file({ id: 'file-1', projectId: 'legacy-project', ownerCollaboratorId: 'pharos' })],
          workspaceReferenceDocs: []
        }
      }]
    }));

    const result = await commitCollectionRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'collection-rows-repair-test',
      activeProjectId: 'legacy-project'
    });
    const recoveredProjectRow = await kvGet<LocalDataCompleteRow<CollectionObjectRow>>(
      getLocalDataRowKey(getCollectionObjectLocalDataRef('project', 'legacy-project'))
    );

    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 1,
      projectedObjectCount: 2,
      recoveredProjectCount: 1,
      expectedRepositoryRowCount: 3,
      actualRepositoryRowCount: 3
    }));
    expect(recoveredProjectRow?.value).toEqual(expect.objectContaining({
      objectId: 'project:legacy-project',
      ownerCollaboratorId: 'pharos'
    }));
  });

  it('normalizes recoverable odd legacy collection shapes before committing rows', async () => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        {
          key: 'collection-state-v2',
          value: {
            cards: [
              {
                id: 'legacy-card',
                title: '   ',
                code: '<main>legacy owner field</main>',
                language: 'made-up-language',
                tags: ['', 'ui', 'ui'],
                ownerPersonaId: 'nova',
                source: 'manual'
              },
              {
                id: 'legacy-file-card',
                title: 'Project file card',
                code: 'export const value = 1;',
                language: 'typescript',
                projectId: 'ghost-project',
                filePath: './src/../src/App.tsx',
                fileRole: 'entry',
                ownerPersonaId: 'nova',
                source: 'chat-generated'
              }
            ],
            imageCards: [{
              id: 'legacy-image',
              assetId: 'asset-image',
              imageName: 'IMG_0001.png',
              title: 'IMG_0001.png',
              tags: [],
              ownerPersonaId: 'nova',
              source: 'chat-generated'
            }],
            roomProjects: [],
            projectFiles: [{
              id: 'loose-file',
              projectId: 'ghost-project',
              filePath: ' ./README.md ',
              language: 'markdown',
              content: '# loose',
              ownerCollaboratorId: 'nova',
              source: 'manual'
            }],
            workspaceReferenceDocs: [{
              id: 'loose-doc',
              projectId: 'ghost-project',
              title: '  ',
              summary: '  ',
              content: '',
              charCount: 11,
              contentLoaded: false,
              ownerCollaboratorId: 'nova',
              source: 'manual'
            }],
            deletedBundledCardIds: ['', 'starter-card', 'starter-card']
          }
        },
        {
          key: `${WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX}${workspaceReferenceDocContentKey('loose-doc')}`,
          value: 'restored doc'
        },
        {
          key: 'space-theme-state-v1',
          value: { collectionProjectId: 'ghost-project' }
        },
        {
          key: 'persona-state-v2',
          value: { personas: [{ id: 'nova' }], activeCollaboratorId: 'nova' }
        }
      ],
      assetMeta: [
        {
          key: 'asset-image',
          value: {
            id: 'asset-image',
            kind: 'image',
            name: 'IMG_0001.png',
            mimeType: 'image/png',
            size: 5,
            createdAt: 1
          }
        }
      ],
      assetBinary: [
        {
          key: 'asset-image',
          value: new Blob(['image'])
        }
      ]
    }));

    const result = await commitCollectionRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'collection-odd-shapes-test'
    });

    const cardRow = await kvGet<LocalDataCompleteRow<CollectionObjectRow>>(
      getLocalDataRowKey(getCollectionObjectLocalDataRef('card', 'legacy-card'))
    );
    const legacyProjectFileRow = await kvGet<LocalDataCompleteRow<CollectionObjectRow>>(
      getLocalDataRowKey(getCollectionObjectLocalDataRef('project-file', 'legacy-file-card'))
    );
    const looseProjectFileRow = await kvGet<LocalDataCompleteRow<CollectionObjectRow>>(
      getLocalDataRowKey(getCollectionObjectLocalDataRef('project-file', 'loose-file'))
    );
    const recoveredProjectRow = await kvGet<LocalDataCompleteRow<CollectionObjectRow>>(
      getLocalDataRowKey(getCollectionObjectLocalDataRef('project', 'ghost-project'))
    );
    const imageRow = await kvGet<LocalDataCompleteRow<CollectionObjectRow>>(
      getLocalDataRowKey(getCollectionObjectLocalDataRef('image-card', 'legacy-image'))
    );
    const workspaceDocRow = await kvGet<LocalDataCompleteRow<CollectionObjectRow>>(
      getLocalDataRowKey(getCollectionObjectLocalDataRef('workspace-doc', 'loose-doc'))
    );
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 5,
      projectedObjectCount: 6,
      recoveredProjectCount: 1,
      expectedRepositoryRowCount: 7,
      actualRepositoryRowCount: 7
    }));
    expect(cardRow?.value).toEqual(expect.objectContaining({
      objectId: 'card:legacy-card',
      ownerCollaboratorId: 'nova',
      value: expect.objectContaining({
        title: '未命名房间',
        ownerCollaboratorId: 'nova',
        tags: ['ui']
      })
    }));
    expect(legacyProjectFileRow?.value).toEqual(expect.objectContaining({
      objectId: 'project-file:legacy-file-card',
      ownerCollaboratorId: 'nova',
      projectId: 'ghost-project'
    }));
    expect(looseProjectFileRow?.value).toEqual(expect.objectContaining({
      objectId: 'project-file:loose-file',
      ownerCollaboratorId: 'nova',
      projectId: 'ghost-project'
    }));
    expect(recoveredProjectRow?.value).toEqual(expect.objectContaining({
      objectId: 'project:ghost-project',
      ownerCollaboratorId: 'nova'
    }));
    expect(imageRow?.value).toEqual(expect.objectContaining({
      objectId: 'image-card:legacy-image',
      ownerCollaboratorId: 'nova'
    }));
    expect(workspaceDocRow?.value).toEqual(expect.objectContaining({
      objectId: 'workspace-doc:loose-doc',
      ownerCollaboratorId: 'nova',
      assetRefs: [],
      value: expect.objectContaining({
        title: '未命名资料',
        content: 'restored doc',
        contentLoaded: true
      })
    }));
    expect(activeDataSource).toBeNull();
  });
});
