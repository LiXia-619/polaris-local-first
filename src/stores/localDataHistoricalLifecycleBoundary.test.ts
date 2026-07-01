import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../config/persona/personaBuilder';
import {
  buildRuntimeLocalDataUnitOfWork,
  buildRuntimeObjectLocalDataRow,
  buildSpaceLocalDataUnitOfWork,
  buildSpaceObjectLocalDataRow,
  createCompleteLocalDataRow,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getAssetDomainMetaLocalDataRef,
  getAssetObjectLocalDataRef,
  getChatDomainMetaLocalDataRef,
  getCollectionDomainMetaLocalDataRef,
  getCollectionObjectLocalDataRef,
  getConversationCatalogLocalDataRef,
  getPersonaDomainMetaLocalDataRef,
  getPersonaObjectLocalDataRef,
  LOCAL_DATA_SCHEMA_VERSION,
  toCollectionObjectId,
  toRuntimeObjectId,
  toSpaceObjectId,
  type AssetDomainMetaRow,
  type AssetObjectRow,
  type ChatDomainMetaRow,
  type CollectionDomainMetaRow,
  type CollectionObjectRow,
  type ConversationCatalogRow,
  type LocalDataDomain,
  type LocalDataUnitOfWork,
  type PersonaDomainMetaRow,
  type PersonaObjectRow,
  type RuntimeObjectRow,
  type SpaceLocalDataState,
  type SpaceObjectRow
} from '../engines/localData';
import { ASSET_META_STORE, dbStoreSet, setPersistenceBackendForTesting, type PersistedDbEntry, type PersistedKvMutation, type PersistenceBackend } from '../infrastructure/persistence';
import { getAssetMeta, listAssetMeta, type StoredAssetMeta } from '../infrastructure/assetStore';
import type { CodeCard, ProviderProfile, SavedSkin } from '../types/domain';
import { DEFAULT_PROVIDER } from './runtimeStoreProviders';
import { normalizeRuntimePayload } from './runtimeStorePersistence';
import { readRuntimePayloadFromLocalDataRepositoryIfActive } from './runtimeLocalDataPersistence';
import { DEFAULT_APP_CUSTOMIZATION } from './runtimeStoreCustomization';
import { createInitialThemeState } from './spaceStoreTheme';
import { readSpaceStateFromLocalDataRepositoryIfActive } from './spaceLocalDataPersistence';
import { readChatStateFromLocalDataRepository } from './chat/read';
import { projectHydratedChatStorePatch } from './chatStoreHydration';
import { readPersonaStateFromLocalDataRepositoryIfActive } from './personaLocalDataPersistence';
import { readCollectionStateFromLocalDataRepositoryIfActive } from './collectionLocalDataPersistence';

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
    async dbStoreEntrySizes(storeName: string) {
      return Array.from(getStore(storeName).entries()).map(([key, value]) => ({
        key,
        size: value instanceof Blob ? value.size : 0
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

let commitSequence = 0;

function localDataRepository() {
  return createLocalDataRepository({
    backend: createLocalDataKvBackend(),
    now: () => 100 + commitSequence,
    createCommitId: (unit) => `${unit.domain}:historical-boundary:${++commitSequence}`
  });
}

async function commitAndActivate(unit: LocalDataUnitOfWork) {
  const repository = localDataRepository();
  const meta = await repository.commit(unit);
  await repository.activateDomainsFromCommittedRows([meta]);
}

function unitOfWork(domain: LocalDataDomain, mutations: LocalDataUnitOfWork['mutations']): LocalDataUnitOfWork {
  return {
    domain,
    version: LOCAL_DATA_SCHEMA_VERSION,
    mutations
  };
}

function persona(id: string) {
  return createPersonaTemplate({
    id,
    name: id,
    description: '',
    memory: {
      inheritGlobal: true,
      crossConversationRecallEnabled: true,
      excludedGlobalIds: [],
      personalMemories: [],
      referenceDocs: []
    }
  });
}

function collectionCard(id: string): CodeCard {
  return {
    id,
    title: id,
    language: 'html',
    code: '',
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1
  };
}

function provider(id: string): ProviderProfile {
  return {
    ...DEFAULT_PROVIDER,
    id,
    name: id,
    baseUrl: 'https://api.example.com',
    apiKey: '',
    model: 'model-a',
    capabilities: { ...DEFAULT_PROVIDER.capabilities }
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

function spaceState(overrides: Partial<SpaceLocalDataState> = {}): SpaceLocalDataState {
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
    theme: createInitialThemeState(),
    customization: DEFAULT_APP_CUSTOMIZATION,
    collaboratorThemes: {},
    ...overrides
  };
}

function historicalChatCatalogRow(id: string) {
  const value: ConversationCatalogRow = {
    id,
    title: 'Historical chat',
    kind: 'direct',
    collaboratorId: 'pharos',
    activeProjectId: null,
    pinnedAt: null,
    updatedAt: 1,
    messageCount: 3,
    latestMessageTimestamp: 1,
    state: 'archive',
    legacyRef: { layer: 'chat-catalog-v1', recordKey: `chat-conversation-record-v1:${id}` },
    lifecycleReason: 'historical test fixture',
    recordVersion: LOCAL_DATA_SCHEMA_VERSION
  };
  return createCompleteLocalDataRow({
    ref: getConversationCatalogLocalDataRef(id),
    value,
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 1
  });
}

function historicalPersonaRow(id: string) {
  const value: PersonaObjectRow = {
    id,
    objectId: `collaborator:${id}`,
    kind: 'collaborator',
    value: persona(id),
    active: false,
    assetRefs: [],
    referenceDocIds: [],
    referenceDocCount: 0,
    state: 'archive',
    legacyRef: { layer: 'persona-state-v2', recordKey: id },
    lifecycleReason: 'historical test fixture',
    updatedAt: 1
  };
  return createCompleteLocalDataRow({
    ref: getPersonaObjectLocalDataRef(id),
    value,
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 1
  });
}

function historicalCollectionCardRow(id: string) {
  const value: CollectionObjectRow<'card'> = {
    id,
    objectId: toCollectionObjectId('card', id),
    kind: 'card',
    value: collectionCard(id),
    ownerCollaboratorId: null,
    projectId: null,
    assetRefs: [],
    state: 'archive',
    legacyRef: { layer: 'collection-state-v2', recordKey: id },
    lifecycleReason: 'historical test fixture',
    updatedAt: 1
  };
  return createCompleteLocalDataRow({
    ref: getCollectionObjectLocalDataRef('card', id),
    value,
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 1
  });
}

function historicalRuntimeProviderRow(id: string) {
  const row = buildRuntimeObjectLocalDataRow({
    kind: 'provider',
    value: provider(id),
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 1
  });
  return {
    ...row,
    value: {
      ...row.value,
      state: 'archive',
      legacyRef: { layer: 'runtime-providers-v2', recordKey: id },
      lifecycleReason: 'historical test fixture'
    } satisfies RuntimeObjectRow<'provider'>
  };
}

function historicalSpaceSkinRow(id: string) {
  const row = buildSpaceObjectLocalDataRow({
    kind: 'skin',
    value: {
      id,
      value: savedSkin(id),
      assetRefs: [],
      updatedAt: 10
    },
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 10
  });
  return {
    ...row,
    value: {
      ...row.value,
      state: 'archive',
      legacyRef: { layer: 'space-theme-state-v1', recordKey: id },
      lifecycleReason: 'historical test fixture'
    } satisfies SpaceObjectRow<'skin'>
  };
}

function historicalAssetRow(id: string) {
  const value: AssetObjectRow = {
    id,
    objectId: `asset:${id}`,
    kind: 'image',
    name: 'old.png',
    mimeType: 'image/png',
    size: 5,
    createdAt: 1,
    hasMeta: true,
    hasBinary: false,
    hasPreview: false,
    binaryBytes: 0,
    previewBytes: 0,
    ownerRefs: [],
    ownerCount: 0,
    orphan: true,
    state: 'archive',
    legacyRef: { layer: 'asset-meta', recordKey: id },
    lifecycleReason: 'historical test fixture',
    updatedAt: 1
  };
  return createCompleteLocalDataRow({
    ref: getAssetObjectLocalDataRef(id),
    value,
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 1
  });
}

describe('historical lifecycle LocalData boundary', () => {
  beforeEach(() => {
    commitSequence = 0;
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  it('keeps chat lifecycle catalog rows out of the hydrated normal chat store patch', async () => {
    const domainMeta: ChatDomainMetaRow = {
      id: 'chat',
      activeConversationId: null,
      activeGroupRoomId: null,
      groupRooms: [],
      activeConversationCount: 0,
      quarantinedConversationCount: 0,
      totalConversationCount: 1,
      updatedAt: 1
    };
    await commitAndActivate(unitOfWork('chat', [
      { type: 'put', row: createCompleteLocalDataRow({ ref: getChatDomainMetaLocalDataRef(), value: domainMeta, version: LOCAL_DATA_SCHEMA_VERSION, updatedAt: 1 }) },
      { type: 'put', row: historicalChatCatalogRow('chat-archive') }
    ]));

    const persisted = await readChatStateFromLocalDataRepository();
    const projected = projectHydratedChatStorePatch(persisted);

    expect(persisted?.legacyLifecycleByConversationId).toEqual({
      'chat-archive': { state: 'archive', reason: 'historical test fixture' }
    });
    expect(projected.conversations).toEqual([]);
    expect(projected.activeConversationId).toBeNull();
    expect(projected.inputDraft).toBe('');
  });

  it('fails loudly when chat domain meta points at a lifecycle row', async () => {
    const domainMeta: ChatDomainMetaRow = {
      id: 'chat',
      activeConversationId: 'chat-archive',
      activeGroupRoomId: null,
      groupRooms: [],
      activeConversationCount: 0,
      quarantinedConversationCount: 0,
      totalConversationCount: 1,
      updatedAt: 1
    };
    await commitAndActivate(unitOfWork('chat', [
      { type: 'put', row: createCompleteLocalDataRow({ ref: getChatDomainMetaLocalDataRef(), value: domainMeta, version: LOCAL_DATA_SCHEMA_VERSION, updatedAt: 1 }) },
      { type: 'put', row: historicalChatCatalogRow('chat-archive') }
    ]));

    await expect(readChatStateFromLocalDataRepository())
      .rejects.toThrow('Active chat LocalData metadata points at a missing conversation: chat-archive');
  });

  it('keeps persona lifecycle rows as historical markers, never live personas', async () => {
    const domainMeta: PersonaDomainMetaRow = {
      id: 'persona',
      activeCollaboratorId: 'persona-archive',
      activeObjectCount: 0,
      totalObjectCount: 1,
      seededDefaultPersonaIds: [],
      updatedAt: 1
    };
    await commitAndActivate(unitOfWork('persona', [
      { type: 'put', row: createCompleteLocalDataRow({ ref: getPersonaDomainMetaLocalDataRef(), value: domainMeta, version: LOCAL_DATA_SCHEMA_VERSION, updatedAt: 1 }) },
      { type: 'put', row: historicalPersonaRow('persona-archive') }
    ]));

    const payload = await readPersonaStateFromLocalDataRepositoryIfActive();

    expect(payload?.personas).toEqual([]);
    expect(payload?.activeCollaboratorId).toBe('persona-archive');
    expect(payload?.legacyLifecycleByPersonaId).toEqual({
      'persona-archive': { state: 'archive', reason: 'historical test fixture' }
    });
  });

  it('keeps collection lifecycle rows as historical markers, never collection objects', async () => {
    const domainMeta: CollectionDomainMetaRow = {
      id: 'collection',
      activeProjectId: null,
      activeObjectCount: 0,
      totalObjectCount: 1,
      objectCounts: {
        card: 0,
        'image-card': 0,
        project: 0,
        'project-file': 0,
        'workspace-doc': 0
      },
      deletedBundledCardIds: [],
      updatedAt: 1
    };
    await commitAndActivate(unitOfWork('collection', [
      { type: 'put', row: createCompleteLocalDataRow({ ref: getCollectionDomainMetaLocalDataRef(), value: domainMeta, version: LOCAL_DATA_SCHEMA_VERSION, updatedAt: 1 }) },
      { type: 'put', row: historicalCollectionCardRow('card-archive') }
    ]));

    const state = await readCollectionStateFromLocalDataRepositoryIfActive();

    expect(state?.cards).toEqual([]);
    expect(state?.imageCards).toEqual([]);
    expect(state?.roomProjects).toEqual([]);
    expect(state?.projectFiles).toEqual([]);
    expect(state?.workspaceReferenceDocs).toEqual([]);
    expect(state?.legacyLifecycleByObjectId).toEqual({
      'card:card-archive': {
        kind: 'card',
        id: 'card-archive',
        state: 'archive',
        reason: 'historical test fixture'
      }
    });
  });

  it('keeps runtime lifecycle rows out of the runtime payload', async () => {
    const payload = normalizeRuntimePayload({ providers: [], activeProviderId: null });
    const unit = buildRuntimeLocalDataUnitOfWork({
      state: payload,
      version: LOCAL_DATA_SCHEMA_VERSION,
      updatedAt: 1
    });
    await commitAndActivate({
      ...unit,
      mutations: [
        ...unit.mutations,
        { type: 'put', row: historicalRuntimeProviderRow('provider-archive') }
      ]
    });

    const read = await readRuntimePayloadFromLocalDataRepositoryIfActive();

    expect(read?.payload.providers.map((entry) => entry.id)).not.toContain('provider-archive');
    expect(read?.payload.activeProviderId).not.toBe('provider-archive');
    expect(read?.legacyLifecycleByObjectId).toEqual({
      [toRuntimeObjectId('provider', 'provider-archive')]: {
        kind: 'provider',
        id: 'provider-archive',
        state: 'archive',
        reason: 'historical test fixture'
      }
    });
  });

  it('keeps space lifecycle rows out of the space state', async () => {
    const unit = buildSpaceLocalDataUnitOfWork({
      state: spaceState(),
      version: LOCAL_DATA_SCHEMA_VERSION,
      updatedAt: 1
    });
    await commitAndActivate({
      ...unit,
      mutations: [
        ...unit.mutations,
        { type: 'put', row: historicalSpaceSkinRow('skin-archive') }
      ]
    });

    const read = await readSpaceStateFromLocalDataRepositoryIfActive();

    expect(read?.state.theme.savedSkins).toEqual([]);
    expect(read?.legacyLifecycleByObjectId).toEqual({
      [toSpaceObjectId('skin', 'skin-archive')]: {
        kind: 'skin',
        id: 'skin-archive',
        state: 'archive',
        reason: 'historical test fixture'
      }
    });
  });

  it('keeps asset lifecycle rows and legacy meta out of active asset reads', async () => {
    const domainMeta: AssetDomainMetaRow = {
      id: 'asset',
      activeObjectCount: 0,
      totalObjectCount: 1,
      objectCounts: { image: 0, file: 0, unknown: 0 },
      orphanObjectCount: 0,
      missingMetaCount: 0,
      missingBinaryCount: 0,
      previewOnlyCount: 0,
      totalBinaryBytes: 0,
      totalPreviewBytes: 0,
      updatedAt: 1
    };
    const legacyMeta: StoredAssetMeta = {
      id: 'asset-archive',
      kind: 'image',
      name: 'old.png',
      mimeType: 'image/png',
      size: 5,
      createdAt: 1
    };
    await dbStoreSet(ASSET_META_STORE, legacyMeta.id, legacyMeta);
    await commitAndActivate(unitOfWork('asset', [
      { type: 'put', row: createCompleteLocalDataRow({ ref: getAssetDomainMetaLocalDataRef(), value: domainMeta, version: LOCAL_DATA_SCHEMA_VERSION, updatedAt: 1 }) },
      { type: 'put', row: historicalAssetRow(legacyMeta.id) }
    ]));

    expect(await getAssetMeta(legacyMeta.id)).toBeNull();
    expect(await listAssetMeta()).toEqual([]);
  });
});
