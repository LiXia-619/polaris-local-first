import { afterEach, describe, expect, it } from 'vitest';
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
  getSpaceDomainMetaLocalDataRef,
  getSpaceObjectLocalDataRef,
  type CommitPointerRow,
  type SpaceDomainMetaRow,
  type LocalDataCompleteRow,
  type SpaceObjectRow
} from '../engines/localData';
import { DEFAULT_APP_CUSTOMIZATION } from './runtimeStoreCustomization';
import { createInitialThemeState } from './spaceStoreTheme';
import { SPACE_THEME_STATE_KEY, type PersistedSpaceThemeState } from './spaceStorePersistence';
import { commitSpaceRowsMigrationFromCurrentPersistence } from './spaceMigrationPersistence';

const originalWindow = globalThis.window;

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

function setMockLocalStorage(entries: Record<string, string>) {
  const keys = Object.keys(entries);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        length: keys.length,
        key: (index: number) => keys[index] ?? null,
        getItem: (key: string) => entries[key] ?? null,
        setItem: (key: string, value: string) => {
          entries[key] = value;
          if (!keys.includes(key)) keys.push(key);
        },
        removeItem: (key: string) => {
          delete entries[key];
          const index = keys.indexOf(key);
          if (index >= 0) keys.splice(index, 1);
        }
      }
    }
  });
}

afterEach(() => {
  setPersistenceBackendForTesting(null);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow
  });
});

describe('commitSpaceRowsMigrationFromCurrentPersistence', () => {
  it('commits merged space rows from localStorage frontstage and KV theme without promoting activeDataSource', async () => {
    const theme = createInitialThemeState();
    const themePayload: PersistedSpaceThemeState = {
      theme,
      customization: {
        ...DEFAULT_APP_CUSTOMIZATION,
        backgroundAssetId: 'asset-background'
      },
      collaboratorThemes: {
        pharos: {
          theme,
          customization: {
            ...DEFAULT_APP_CUSTOMIZATION
          }
        }
      }
    };
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        { key: SPACE_THEME_STATE_KEY, value: themePayload },
        {
          key: 'persona-state-v2',
          value: { personas: [{ id: 'pharos' }], activeCollaboratorId: 'pharos' }
        }
      ]
    }));
    setMockLocalStorage({
      'polaris-space-store-v1': JSON.stringify({
        state: {
          frontstageSchemaVersion: 4,
          activeWorld: 'chat',
          collectionShelf: 'image',
          frontstageCollaboratorId: 'pharos',
          collectionProjectId: 'project-1',
          editingCollaboratorId: null,
          screenshotDebugOverlayEnabled: true,
          displayPreferences: {
            hapticsEnabled: true,
            fontScale: 1
          },
          activeCardId: 'card-1'
        },
        version: 20
      })
    });

    const result = await commitSpaceRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'space-rows-test'
    });

    const frontstageRow = await kvGet<LocalDataCompleteRow<SpaceObjectRow>>(
      getLocalDataRowKey(getSpaceObjectLocalDataRef('frontstage', 'space-frontstage'))
    );
    const customizationRow = await kvGet<LocalDataCompleteRow<SpaceObjectRow>>(
      getLocalDataRowKey(getSpaceObjectLocalDataRef('customization', 'space-customization'))
    );
    const pointer = await kvGet<CommitPointerRow>(getLocalDataCommitPointerKey('space'));
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    expect(result.commitMeta).toEqual({
      domain: 'space',
      version: 7,
      committedAt: 100,
      commitId: 'space-rows-test'
    });
    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 4,
      projectedObjectCount: 4,
      expectedRepositoryRowCount: 5,
      actualRepositoryRowCount: 5,
      blockers: [],
      warnings: []
    }));
    expect(frontstageRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        objectId: 'frontstage:space-frontstage',
        value: expect.objectContaining({
          activeWorld: 'chat',
          collectionShelf: 'image',
          frontstageCollaboratorId: 'pharos',
          collectionProjectId: 'project-1',
          activeCardId: 'card-1'
        })
      })
    }));
    expect(customizationRow?.value).toEqual(expect.objectContaining({
      objectId: 'customization:space-customization',
      assetRefs: ['asset-background']
    }));
    expect(pointer).toEqual({
      domain: 'space',
      version: 7,
      committedAt: 100,
      commitId: 'space-rows-test'
    });
    expect(activeDataSource).toBeNull();
  });

  it('normalizes odd space localStorage and theme payloads before committing rows', async () => {
    const theme = createInitialThemeState();
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        {
          key: SPACE_THEME_STATE_KEY,
          value: {
            theme: {
              ...theme,
              activeSavedSkinId: 'missing-skin',
              savedSkins: [{
                id: 'skin-a',
                name: 'Skin A',
                sourcePresetId: null,
                cssVariables: {},
                presetCSS: '',
                customCSS: '.x { color: red; }',
                generatedCSS: '',
                createdAt: 1,
                updatedAt: 2
              }],
              selectedSurfaceCodes: ['bad-surface', 'chat.composer', 'chat.composer']
            },
            customization: {
              showChatAvatars: true,
              starColor: '#ABC',
              backgroundOpacity: 99,
              backgroundDim: -1,
              backgroundBlur: 999,
              backgroundFit: 'tile',
              customFontAssetIds: [' ', 'font-a', 'font-a'],
              customFontScopeAssignments: {
                global: 'font-a',
                cards: 'missing-font'
              }
            },
            collaboratorThemes: {
              ' ': {
                theme,
                customization: {}
              },
              nova: {
                theme: {
                  ...theme,
                  savedSkins: [{
                    id: 'skin-b',
                    name: 'Skin B',
                    sourcePresetId: null,
                    cssVariables: {},
                    presetCSS: '',
                    customCSS: '.y { color: blue; }',
                    generatedCSS: '',
                    createdAt: 3,
                    updatedAt: 4
                  }],
                  activeSavedSkinId: 'skin-b'
                },
                customization: {
                  starColor: '#123'
                }
              }
            }
          }
        },
        {
          key: 'persona-state-v2',
          value: { personas: [{ id: 'nova' }], activeCollaboratorId: 'nova' }
        }
      ]
    }));
    setMockLocalStorage({
      'polaris-space-store-v1': JSON.stringify({
        state: {
          activeWorld: 'bad-world',
          collectionShelf: 'image',
          currentCollaboratorId: 'nova',
          collectionProjectId: '   ',
          editingCollaboratorId: 'editing-persona',
          screenshotDebugOverlayEnabled: 'yes',
          displayPreferences: {
            hapticsEnabled: true,
            fontScale: 999
          },
          activeCardId: ''
        },
        version: 1
      })
    });

    const result = await commitSpaceRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'space-odd-shapes-test'
    });

    const domainMetaRow = await kvGet<LocalDataCompleteRow<SpaceDomainMetaRow>>(
      getLocalDataRowKey(getSpaceDomainMetaLocalDataRef())
    );
    const frontstageRow = await kvGet<LocalDataCompleteRow<SpaceObjectRow>>(
      getLocalDataRowKey(getSpaceObjectLocalDataRef('frontstage', 'space-frontstage'))
    );
    const customizationRow = await kvGet<LocalDataCompleteRow<SpaceObjectRow<'customization'>>>(
      getLocalDataRowKey(getSpaceObjectLocalDataRef('customization', 'space-customization'))
    );
    const themeRow = await kvGet<LocalDataCompleteRow<SpaceObjectRow<'theme'>>>(
      getLocalDataRowKey(getSpaceObjectLocalDataRef('theme', 'space-theme'))
    );
    const collaboratorThemeRow = await kvGet<LocalDataCompleteRow<SpaceObjectRow>>(
      getLocalDataRowKey(getSpaceObjectLocalDataRef('collaborator-theme', 'nova'))
    );
    const blankCollaboratorThemeRow = await kvGet(
      getLocalDataRowKey(getSpaceObjectLocalDataRef('collaborator-theme', ' '))
    );
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    // 3 singletons + 1 collaborator theme + 2 shared skins (skin-a from the main theme,
    // skin-b lifted out of the collaborator session into the shared library).
    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 6,
      projectedObjectCount: 6,
      expectedRepositoryRowCount: 7,
      actualRepositoryRowCount: 7
    }));
    expect(domainMetaRow?.value).toEqual(expect.objectContaining({
      frontstageCollaboratorId: 'nova',
      collectionProjectId: null,
      objectCounts: expect.objectContaining({
        'collaborator-theme': 1,
        skin: 2
      })
    }));
    expect(frontstageRow?.value.value).toEqual(expect.objectContaining({
      activeWorld: 'collection',
      collectionShelf: 'image',
      frontstageCollaboratorId: 'nova',
      collectionProjectId: null,
      screenshotDebugOverlayEnabled: false,
      activeCardId: null,
      displayPreferences: expect.objectContaining({
        hapticsEnabled: false
      })
    }));
    expect(customizationRow?.value.value.value).toEqual(expect.objectContaining({
      showChatAvatars: true,
      starColor: '#aabbcc',
      backgroundOpacity: 0.82,
      backgroundDim: 0,
      backgroundBlur: 28,
      backgroundFit: 'cover',
      customFontAssetIds: ['font-a'],
      customFontScopeAssignments: expect.objectContaining({
        global: 'font-a',
        cards: null
      })
    }));
    // The saved-skin library is split into skin rows; the theme row keeps only the order
    // and a stripped (empty) library.
    expect(themeRow?.value.value.savedSkinOrder).toEqual(
      expect.arrayContaining(['skin-a', 'skin-b'])
    );
    expect(themeRow?.value.value.value).toEqual(expect.objectContaining({
      activeSavedSkinId: null,
      savedSkins: []
    }));
    const skinARow = await kvGet<LocalDataCompleteRow<SpaceObjectRow<'skin'>>>(
      getLocalDataRowKey(getSpaceObjectLocalDataRef('skin', 'skin-a'))
    );
    const skinBRow = await kvGet<LocalDataCompleteRow<SpaceObjectRow<'skin'>>>(
      getLocalDataRowKey(getSpaceObjectLocalDataRef('skin', 'skin-b'))
    );
    expect(skinARow?.value.value).toEqual(expect.objectContaining({ id: 'skin-a' }));
    expect(skinBRow?.value.value).toEqual(expect.objectContaining({ id: 'skin-b' }));
    expect(collaboratorThemeRow?.value).toEqual(expect.objectContaining({
      objectId: 'collaborator-theme:nova',
      ownerCollaboratorId: 'nova'
    }));
    expect(blankCollaboratorThemeRow).toBeNull();
    expect(activeDataSource).toBeNull();
  });
});
