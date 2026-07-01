import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSpaceLocalDataUnitOfWork,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  getSpaceObjectLocalDataRef,
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataActiveDataSourceRow,
  type LocalDataCommitMeta
} from '../engines/localData';
import {
  kvGet,
  kvSet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistedKvMutation,
  type PersistenceBackend
} from '../infrastructure/persistence';
import type { SpaceLocalDataState } from '../engines/localData';
import type { SavedSkin } from '../types/domain';
import { DEFAULT_APP_CUSTOMIZATION } from './runtimeStoreCustomization';
import { readPersistedSpaceThemeState, writePersistedSpaceThemeState } from './spaceStorePersistence';
import { createInitialThemeState } from './spaceStoreTheme';

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
      return Array.from(getStore(storeName).entries()).map(([key, value]) => ({
        key,
        value: value as T
      }));
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
        if (mutation.type === 'set') {
          store.set(mutation.key, mutation.value);
        } else {
          store.delete(mutation.key);
        }
      }
    },
    async kvReplaceAll(entries) {
      stores.set('kv', new Map(entries.map((entry) => [entry.key, entry.value])));
    }
  };
}

function spaceState(overrides: Partial<SpaceLocalDataState> = {}): SpaceLocalDataState {
  const theme = createInitialThemeState();
  return {
    activeWorld: 'collection',
    collectionShelf: 'code',
    frontstageCollaboratorId: null,
    collectionProjectId: null,
    editingCollaboratorId: null,
    screenshotDebugOverlayEnabled: false,
    appLanguage: 'zh-CN',
    displayPreferences: {
      appearance: 'system',
      hapticsEnabled: true,
      fontScale: 1
    },
    activeCardId: null,
    theme,
    customization: DEFAULT_APP_CUSTOMIZATION,
    collaboratorThemes: {},
    ...overrides
  };
}

function savedSkin(id: string): SavedSkin {
  return {
    id,
    name: id,
    sourcePresetId: null,
    cssVariables: {},
    presetCSS: '',
    customCSS: '',
    generatedCSS: '',
    createdAt: 10,
    updatedAt: 10
  };
}

async function promoteSpaceState(state: SpaceLocalDataState) {
  const repository = createLocalDataRepository({
    backend: createLocalDataKvBackend(),
    now: () => 100,
    createCommitId: () => 'space:initial'
  });
  const meta = await repository.commit(buildSpaceLocalDataUnitOfWork({
    state,
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 100
  }));
  await kvSet(getLocalDataActiveDataSourceKey(), activeSourceRow(meta));
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
      space: {
        domain: 'space',
        version: meta.version,
        committedAt: meta.committedAt,
        commitId: meta.commitId
      }
    }
  };
}

describe('space LocalData persistence', () => {
  beforeEach(() => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  it('hydrates complete space state from repository when space is the active source', async () => {
    await promoteSpaceState(spaceState({
      activeWorld: 'chat',
      collectionShelf: 'project',
      activeCardId: 'card-1',
      collectionProjectId: 'project-1'
    }));

    const state = (await readPersistedSpaceThemeState())?.themeState as unknown as { activeWorld?: string; activeCardId?: string; collectionProjectId?: string } | undefined ?? null;

    expect(state).toEqual(expect.objectContaining({
      activeWorld: 'chat',
      activeCardId: 'card-1',
      collectionProjectId: 'project-1'
    }));
  });

  it('writes full space state to repository and tombstones stale collaborator theme rows when active', async () => {
    const oldTheme = createInitialThemeState();
    const newTheme = createInitialThemeState();
    await promoteSpaceState(spaceState({
      collaboratorThemes: {
        old: {
          theme: oldTheme,
          customization: DEFAULT_APP_CUSTOMIZATION
        }
      }
    }));

    await writePersistedSpaceThemeState({
      ...spaceState({
        activeWorld: 'chat',
        activeCardId: 'card-new',
        collaboratorThemes: {
          next: {
            theme: newTheme,
            customization: DEFAULT_APP_CUSTOMIZATION
          }
        }
      }),
      activeThemePreview: null
    });

    const legacyPayload = await kvGet('space-theme-state-v1');
    const staleRow = await kvGet(getLocalDataRowKey(getSpaceObjectLocalDataRef('collaborator-theme', 'old')));
    const activeRow = await kvGet(getLocalDataRowKey(getSpaceObjectLocalDataRef('collaborator-theme', 'next')));
    const frontstageRow = await kvGet(getLocalDataRowKey(getSpaceObjectLocalDataRef('frontstage', 'space-frontstage')));

    expect(legacyPayload).toBeNull();
    expect(staleRow).toEqual(expect.objectContaining({
      state: 'deleted'
    }));
    expect(activeRow).toEqual(expect.objectContaining({
      state: 'complete'
    }));
    expect(frontstageRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        value: expect.objectContaining({
          activeWorld: 'chat',
          activeCardId: 'card-new'
        })
      })
    }));
  });

  it('skips repository commits when the space state is unchanged', async () => {
    const state = spaceState({
      activeWorld: 'chat',
      activeCardId: 'card-1'
    });
    await promoteSpaceState(state);

    await writePersistedSpaceThemeState({
      ...state,
      activeThemePreview: null
    });

    await expect(kvGet(getLocalDataCommitPointerKey('space'))).resolves.toEqual({
      domain: 'space',
      version: LOCAL_DATA_SCHEMA_VERSION,
      committedAt: 100,
      commitId: 'space:initial'
    });
  });

  it('round-trips the saved-skin library through skin rows, preserving order', async () => {
    await promoteSpaceState(spaceState());

    await writePersistedSpaceThemeState({
      ...spaceState({
        theme: {
          ...createInitialThemeState(),
          activeSavedSkinId: 'skin-b',
          savedSkins: [savedSkin('skin-b'), savedSkin('skin-a')]
        }
      }),
      activeThemePreview: null
    });

    // The library bodies live in their own skin rows, not inside the theme row.
    const themeRow = await kvGet(getLocalDataRowKey(getSpaceObjectLocalDataRef('theme', 'space-theme'))) as
      { value: { value: { savedSkinOrder: string[]; value: { savedSkins: unknown[] } } } };
    expect(themeRow.value.value.savedSkinOrder).toEqual(['skin-b', 'skin-a']);
    expect(themeRow.value.value.value.savedSkins).toEqual([]);
    expect((await kvGet(getLocalDataRowKey(getSpaceObjectLocalDataRef('skin', 'skin-a'))) as { state: string }).state)
      .toBe('complete');

    const state = (await readPersistedSpaceThemeState())?.themeState as unknown as { theme?: { savedSkins?: { id: string }[]; activeSavedSkinId?: string | null } } | undefined ?? null;
    expect(state?.theme?.savedSkins?.map((skin) => skin.id)).toEqual(['skin-b', 'skin-a']);
    expect(state?.theme?.activeSavedSkinId).toBe('skin-b');
  });

  it('keeps the saved-skin library shared on the theme, not copied onto collaborator sessions', async () => {
    await promoteSpaceState(spaceState());

    await writePersistedSpaceThemeState({
      ...spaceState({
        theme: { ...createInitialThemeState(), savedSkins: [savedSkin('skin-main')] },
        collaboratorThemes: {
          pharos: {
            theme: { ...createInitialThemeState(), savedSkins: [] },
            customization: DEFAULT_APP_CUSTOMIZATION
          }
        }
      }),
      activeThemePreview: null
    });

    // The collaborator-theme row never carries the shared library.
    const collaboratorRow = await kvGet(getLocalDataRowKey(getSpaceObjectLocalDataRef('collaborator-theme', 'pharos'))) as
      { value: { value: { theme: { savedSkins: unknown[] } } } };
    expect(collaboratorRow.value.value.theme.savedSkins).toEqual([]);

    const state = (await readPersistedSpaceThemeState())?.themeState as unknown as {
      theme?: { savedSkins?: { id: string }[] };
      collaboratorThemes?: Record<string, { theme: { savedSkins: unknown[] } }>;
    } | undefined ?? null;
    // The library lives on the shared theme; the collaborator session has none.
    expect(state?.theme?.savedSkins?.map((skin) => skin.id)).toEqual(['skin-main']);
    expect(state?.collaboratorThemes?.pharos.theme.savedSkins).toEqual([]);
  });

  it('first ordinary save on a fresh install writes LocalData rows and self-activates, never space-theme-state-v1', async () => {
    // A fresh install: no promotion, no active-data-source row.
    await expect(kvGet(getLocalDataActiveDataSourceKey())).resolves.toBeNull();

    await writePersistedSpaceThemeState({
      ...spaceState({
        theme: { ...createInitialThemeState(), savedSkins: [savedSkin('skin-1')] }
      }),
      activeThemePreview: null
    });

    // The legacy whole-state store is never written by an ordinary save.
    await expect(kvGet('space-theme-state-v1')).resolves.toBeNull();

    // LocalData space rows + the space commit pointer were written.
    await expect(kvGet(getLocalDataRowKey(getSpaceObjectLocalDataRef('skin', 'skin-1')))).resolves.toEqual(
      expect.objectContaining({ state: 'complete' })
    );
    await expect(kvGet(getLocalDataCommitPointerKey('space'))).resolves.toEqual(
      expect.objectContaining({ domain: 'space' })
    );

    // The space domain self-activated from its own committed rows: the active-data-source row
    // now points space at the repository (no migration validation report involved).
    const activeSource = (await kvGet(getLocalDataActiveDataSourceKey())) as LocalDataActiveDataSourceRow | null;
    expect(activeSource?.activeDataSource).toBe('repository');
    expect(activeSource?.domains.space).toEqual(expect.objectContaining({ domain: 'space' }));
  });

  it('reads the space state back from the active LocalData rows after a fresh-install save', async () => {
    await writePersistedSpaceThemeState({
      ...spaceState({
        theme: { ...createInitialThemeState(), savedSkins: [savedSkin('skin-1')] }
      }),
      activeThemePreview: null
    });

    // Space is now active, so the read resolves from the repository rows (not the legacy KV),
    // reassembling the saved-skin library from its skin rows.
    const read = await readPersistedSpaceThemeState();
    const themeState = read?.themeState as unknown as { theme?: { savedSkins?: { id: string }[] } } | undefined;
    expect(themeState?.theme?.savedSkins?.map((skin) => skin.id)).toEqual(['skin-1']);
  });
});
