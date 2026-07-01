import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSpaceLocalDataUnitOfWork,
  buildSpaceObjectSeeds,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getLocalDataActiveDataSourceKey,
  getLocalDataRowKey,
  getSpaceDomainMetaLocalDataRef,
  getSpaceObjectLocalDataRef,
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataActiveDataSourceRow,
  type LocalDataCommitMeta,
  type LocalDataStoredRow,
  type SpaceCollaboratorThemeRowValue,
  type SpaceDomainMetaRow,
  type SpaceLocalDataObjectKind,
  type SpaceLocalDataState,
  type SpaceObjectRow
} from '../engines/localData';
import {
  kvGet,
  kvSet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistedKvMutation,
  type PersistenceBackend
} from '../infrastructure/persistence';
import type { SavedSkin, ThemeState } from '../types/domain';
import { DEFAULT_APP_CUSTOMIZATION } from './runtimeStoreCustomization';
import {
  commitSpaceRowChangesFromStateIfActive,
  commitSpaceRowChangesIfActive
} from './spaceLocalDataPersistence';
import { createInitialThemeState } from './spaceStoreTheme';

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

function spaceState(overrides: Partial<SpaceLocalDataState> = {}): SpaceLocalDataState {
  return {
    activeWorld: 'collection',
    collectionShelf: 'code',
    frontstageCollaboratorId: null,
    collectionProjectId: null,
    editingCollaboratorId: null,
    screenshotDebugOverlayEnabled: false,
    appLanguage: 'zh-CN',
    displayPreferences: { appearance: 'system', hapticsEnabled: true, fontScale: 1 },
    activeCardId: null,
    theme: createInitialThemeState(),
    customization: DEFAULT_APP_CUSTOMIZATION,
    collaboratorThemes: {},
    ...overrides
  };
}

function savedSkin(id: string, overrides: Partial<SavedSkin> = {}): SavedSkin {
  return {
    id,
    name: id,
    sourcePresetId: null,
    cssVariables: {},
    presetCSS: '',
    customCSS: '',
    generatedCSS: '',
    createdAt: 10,
    updatedAt: 10,
    ...overrides
  };
}

function themeWithSkins(skins: SavedSkin[], frame: Partial<ThemeState> = {}): ThemeState {
  return { ...createInitialThemeState(), ...frame, savedSkins: skins };
}

function collaboratorThemeValue(id: string): SpaceCollaboratorThemeRowValue {
  const [seed] = buildSpaceObjectSeeds(
    spaceState({ collaboratorThemes: { [id]: { theme: createInitialThemeState(), customization: DEFAULT_APP_CUSTOMIZATION } } }),
    1
  ).filter((candidate) => candidate.kind === 'collaborator-theme');
  return seed.value as SpaceCollaboratorThemeRowValue;
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
      space: { domain: 'space', version: meta.version, committedAt: meta.committedAt, commitId: meta.commitId }
    }
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

function rawObjectRow(kind: SpaceLocalDataObjectKind, id: string) {
  return kvGet<LocalDataStoredRow<SpaceObjectRow<SpaceLocalDataObjectKind>>>(
    getLocalDataRowKey(getSpaceObjectLocalDataRef(kind, id))
  );
}

async function readObjectValue<K extends SpaceLocalDataObjectKind>(kind: K, id: string): Promise<SpaceObjectRow<K>> {
  const row = await rawObjectRow(kind, id);
  if (!row || row.state !== 'complete') throw new Error(`${kind}:${id} is not complete`);
  return row.value as SpaceObjectRow<K>;
}

async function readDomainMeta() {
  const row = await kvGet<LocalDataStoredRow<SpaceDomainMetaRow>>(
    getLocalDataRowKey(getSpaceDomainMetaLocalDataRef())
  );
  if (!row || row.state !== 'complete') throw new Error('space domain meta is not complete');
  return row.value;
}

describe('space row writer', () => {
  beforeEach(() => {
    commitCount = 0;
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  it('upserts one collaborator-theme without rewriting unrelated singleton rows', async () => {
    await promoteSpaceState(spaceState({
      collaboratorThemes: { keep: { theme: createInitialThemeState(), customization: DEFAULT_APP_CUSTOMIZATION } }
    }));
    const frontstageBefore = await rawObjectRow('frontstage', 'space-frontstage');
    commitCount = 0;

    const wrote = await commitSpaceRowChangesIfActive({
      changes: [{ type: 'upsert', kind: 'collaborator-theme', value: collaboratorThemeValue('fresh') }],
      frontstageCollaboratorId: null,
      collectionProjectId: null
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readObjectValue('collaborator-theme', 'fresh')).id).toBe('fresh');
    // The frontstage singleton was not in the change set, so its row is byte-for-byte intact.
    expect(await rawObjectRow('frontstage', 'space-frontstage')).toEqual(frontstageBefore);
    const meta = await readDomainMeta();
    expect(meta.objectCounts['collaborator-theme']).toBe(2);
    expect(meta.totalObjectCount).toBe(5);
  });

  it('value-diffs a frontstage edit and records the owned meta pointers verbatim', async () => {
    await promoteSpaceState(spaceState());
    const themeBefore = await rawObjectRow('theme', 'space-theme');
    const customizationBefore = await rawObjectRow('customization', 'space-customization');
    commitCount = 0;

    const wrote = await commitSpaceRowChangesFromStateIfActive(spaceState({
      activeWorld: 'chat',
      activeCardId: 'card-9',
      frontstageCollaboratorId: 'collab-1',
      collectionProjectId: 'project-7'
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    const frontstage = (await readObjectValue('frontstage', 'space-frontstage')).value;
    expect(frontstage).toEqual(expect.objectContaining({ activeWorld: 'chat', activeCardId: 'card-9' }));
    // theme / customization were unchanged, so their rows are not rewritten.
    expect(await rawObjectRow('theme', 'space-theme')).toEqual(themeBefore);
    expect(await rawObjectRow('customization', 'space-customization')).toEqual(customizationBefore);
    const meta = await readDomainMeta();
    expect(meta.frontstageCollaboratorId).toBe('collab-1');
    expect(meta.collectionProjectId).toBe('project-7');
  });

  it('tombstones a removed collaborator-theme and drops it from the counts', async () => {
    await promoteSpaceState(spaceState({
      collaboratorThemes: {
        keep: { theme: createInitialThemeState(), customization: DEFAULT_APP_CUSTOMIZATION },
        drop: { theme: createInitialThemeState(), customization: DEFAULT_APP_CUSTOMIZATION }
      }
    }));
    commitCount = 0;

    const wrote = await commitSpaceRowChangesFromStateIfActive(spaceState({
      collaboratorThemes: { keep: { theme: createInitialThemeState(), customization: DEFAULT_APP_CUSTOMIZATION } }
    }));

    expect(wrote).toBe(true);
    expect((await rawObjectRow('collaborator-theme', 'drop'))?.state).toBe('deleted');
    expect((await rawObjectRow('collaborator-theme', 'keep'))?.state).toBe('complete');
    const meta = await readDomainMeta();
    expect(meta.objectCounts['collaborator-theme']).toBe(1);
    expect(meta.totalObjectCount).toBe(4);
  });

  it('does not commit when only the synthetic write-time stamp would differ', async () => {
    const state = spaceState({ activeWorld: 'chat', activeCardId: 'card-1' });
    await promoteSpaceState(state);
    commitCount = 0;

    const wrote = await commitSpaceRowChangesFromStateIfActive(spaceState({
      activeWorld: 'chat',
      activeCardId: 'card-1'
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(0);
  });

  it('writes a multi-object batch in a single commit', async () => {
    await promoteSpaceState(spaceState());
    commitCount = 0;

    const wrote = await commitSpaceRowChangesFromStateIfActive(spaceState({
      activeWorld: 'chat',
      collaboratorThemes: {
        a: { theme: createInitialThemeState(), customization: DEFAULT_APP_CUSTOMIZATION },
        b: { theme: createInitialThemeState(), customization: DEFAULT_APP_CUSTOMIZATION }
      }
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    const meta = await readDomainMeta();
    expect(meta.objectCounts['collaborator-theme']).toBe(2);
    expect((await rawObjectRow('collaborator-theme', 'a'))?.state).toBe('complete');
    expect((await rawObjectRow('collaborator-theme', 'b'))?.state).toBe('complete');
  });

  it('throws when a change set writes the same object twice', async () => {
    await promoteSpaceState(spaceState());
    commitCount = 0;

    await expect(commitSpaceRowChangesIfActive({
      changes: [
        { type: 'upsert', kind: 'collaborator-theme', value: collaboratorThemeValue('x') },
        { type: 'delete', kind: 'collaborator-theme', id: 'x' }
      ],
      frontstageCollaboratorId: null,
      collectionProjectId: null
    })).rejects.toThrow(/same object twice/);
    expect(commitCount).toBe(0);
  });

  it('returns false without writing when the space repository is inactive', async () => {
    const wrote = await commitSpaceRowChangesIfActive({
      changes: [{ type: 'upsert', kind: 'collaborator-theme', value: collaboratorThemeValue('x') }],
      frontstageCollaboratorId: null,
      collectionProjectId: null
    });
    expect(wrote).toBe(false);
    expect(commitCount).toBe(0);
  });

  it('splits a new saved skin into its own row and records the order on the theme row', async () => {
    await promoteSpaceState(spaceState());
    commitCount = 0;

    const wrote = await commitSpaceRowChangesFromStateIfActive(spaceState({
      theme: themeWithSkins([savedSkin('skin-1', { customCSS: '.a {}' })])
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readObjectValue('skin', 'skin-1')).value).toEqual(expect.objectContaining({ id: 'skin-1' }));
    const themeValue = await readObjectValue('theme', 'space-theme');
    expect(themeValue.value.savedSkinOrder).toEqual(['skin-1']);
    // The library is stripped from the stored ThemeState — it lives in the skin row.
    expect(themeValue.value.value.savedSkins).toEqual([]);
    expect((await readDomainMeta()).objectCounts.skin).toBe(1);
  });

  it('edits one saved skin without rewriting the other skin row or the theme row', async () => {
    await promoteSpaceState(spaceState({
      theme: themeWithSkins([savedSkin('skin-1'), savedSkin('skin-2')])
    }));
    const skin2Before = await rawObjectRow('skin', 'skin-2');
    const themeBefore = await rawObjectRow('theme', 'space-theme');
    commitCount = 0;

    const wrote = await commitSpaceRowChangesFromStateIfActive(spaceState({
      theme: themeWithSkins([savedSkin('skin-1', { customCSS: '.edited {}', updatedAt: 20 }), savedSkin('skin-2')])
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readObjectValue('skin', 'skin-1')).value.value).toEqual(expect.objectContaining({ customCSS: '.edited {}' }));
    // The other skin and the theme row (order unchanged) are byte-for-byte intact.
    expect(await rawObjectRow('skin', 'skin-2')).toEqual(skin2Before);
    expect(await rawObjectRow('theme', 'space-theme')).toEqual(themeBefore);
  });

  it('tombstones a deleted saved skin and updates the order and count', async () => {
    await promoteSpaceState(spaceState({
      theme: themeWithSkins([savedSkin('skin-1'), savedSkin('skin-2')])
    }));
    commitCount = 0;

    const wrote = await commitSpaceRowChangesFromStateIfActive(spaceState({
      theme: themeWithSkins([savedSkin('skin-1')])
    }));

    expect(wrote).toBe(true);
    expect((await rawObjectRow('skin', 'skin-2'))?.state).toBe('deleted');
    expect((await rawObjectRow('skin', 'skin-1'))?.state).toBe('complete');
    expect((await readObjectValue('theme', 'space-theme')).value.savedSkinOrder).toEqual(['skin-1']);
    expect((await readDomainMeta()).objectCounts.skin).toBe(1);
  });

  it('rewrites the theme row but not the skin rows when activeSavedSkinId changes', async () => {
    await promoteSpaceState(spaceState({
      theme: themeWithSkins([savedSkin('skin-1')], { activeSavedSkinId: null })
    }));
    const skinBefore = await rawObjectRow('skin', 'skin-1');
    commitCount = 0;

    const wrote = await commitSpaceRowChangesFromStateIfActive(spaceState({
      theme: themeWithSkins([savedSkin('skin-1')], { activeSavedSkinId: 'skin-1' })
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readObjectValue('theme', 'space-theme')).value.value.activeSavedSkinId).toBe('skin-1');
    // The active pointer lives on the theme row; the skin body row is untouched.
    expect(await rawObjectRow('skin', 'skin-1')).toEqual(skinBefore);
  });
});
