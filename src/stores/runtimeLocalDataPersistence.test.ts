import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildRuntimeLocalDataUnitOfWork,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  getRuntimeObjectLocalDataRef,
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
import type { ProviderProfile } from '../types/domain';
import { DEFAULT_COMPANION_HOST_STATE } from './runtimeStoreCompanion';
import { DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS } from './runtimeStoreConversationSummary';
import { DEFAULT_IMAGE_GENERATION_SETTINGS } from './runtimeStoreImageGeneration';
import { DEFAULT_IMAGE_UNDERSTANDING_SETTINGS } from './runtimeStoreImageUnderstanding';
import { DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS } from './runtimeStoreMemoryRetrieval';
import { DEFAULT_RUNTIME_MCP_STATE } from './runtimeStoreMcp';
import { DEFAULT_PROVIDER } from './runtimeStoreProviders';
import { DEFAULT_WEB_SEARCH_CONFIG } from './runtimeStoreSearch';
import { hydrateFromDb, persistToDb, type RuntimePayload } from './runtimeStorePersistence';
import { DEFAULT_RUNTIME_TOOLBOX_STATE } from './runtimeStoreToolbox';
import { DEFAULT_RUNTIME_TRIGGER_STATE } from './runtimeStoreTriggers';
import { DEFAULT_VOICE_GENERATION_SETTINGS } from './runtimeStoreVoiceGeneration';
import { DEFAULT_WEBDAV_CONFIG } from './runtimeStoreWebDav';

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

function provider(id: string): ProviderProfile {
  return {
    ...DEFAULT_PROVIDER,
    id,
    name: id,
    baseUrl: 'https://api.example.com',
    apiKey: '',
    model: 'model-a',
    capabilities: {
      ...DEFAULT_PROVIDER.capabilities
    }
  };
}

function runtimePayload(overrides: Partial<RuntimePayload> = {}): RuntimePayload {
  const providers = overrides.providers ?? [provider('provider-1')];
  return {
    providers,
    activeProviderId: overrides.activeProviderId ?? providers[0]?.id ?? null,
    webdav: DEFAULT_WEBDAV_CONFIG,
    search: DEFAULT_WEB_SEARCH_CONFIG,
    conversationSummaryModel: DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS,
    memoryVectorRetrieval: DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS,
    imageGeneration: DEFAULT_IMAGE_GENERATION_SETTINGS,
    imageUnderstanding: DEFAULT_IMAGE_UNDERSTANDING_SETTINGS,
    voiceGeneration: DEFAULT_VOICE_GENERATION_SETTINGS,
    toolPromptPreferences: DEFAULT_RUNTIME_TOOLBOX_STATE.toolPromptPreferences,
    taskModeEnabled: DEFAULT_RUNTIME_TOOLBOX_STATE.taskModeEnabled,
    mcpServers: DEFAULT_RUNTIME_MCP_STATE.mcpServers,
    mcpToolTimeoutSeconds: DEFAULT_RUNTIME_MCP_STATE.mcpToolTimeoutSeconds,
    companionHost: DEFAULT_COMPANION_HOST_STATE,
    companionConnections: [],
    triggerRules: DEFAULT_RUNTIME_TRIGGER_STATE.triggerRules,
    ...overrides
  };
}

async function promoteRuntimeState(payload: RuntimePayload) {
  const repository = createLocalDataRepository({
    backend: createLocalDataKvBackend(),
    now: () => 100,
    createCommitId: () => 'runtime:initial'
  });
  const meta = await repository.commit(buildRuntimeLocalDataUnitOfWork({
    state: payload,
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
      runtime: {
        domain: 'runtime',
        version: meta.version,
        committedAt: meta.committedAt,
        commitId: meta.commitId
      }
    }
  };
}

describe('runtime LocalData persistence', () => {
  beforeEach(() => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  it('hydrates runtime payload from repository when runtime is the active source', async () => {
    await promoteRuntimeState(runtimePayload({
      providers: [provider('provider-repo')],
      activeProviderId: 'provider-repo'
    }));

    const result = await hydrateFromDb({ throwOnReadFailure: true });

    expect(result?.payload).toEqual(expect.objectContaining({
      activeProviderId: 'provider-repo',
      providers: [expect.objectContaining({ id: 'provider-repo' })]
    }));
    expect(result?.shouldPersist).toBe(false);
  });

  it('skips repository commits when the runtime payload is unchanged', async () => {
    const payload = runtimePayload({
      providers: [provider('provider-repo')],
      activeProviderId: 'provider-repo'
    });
    await promoteRuntimeState(payload);

    await persistToDb(payload);

    await expect(kvGet(getLocalDataCommitPointerKey('runtime'))).resolves.toEqual({
      domain: 'runtime',
      version: LOCAL_DATA_SCHEMA_VERSION,
      committedAt: 100,
      commitId: 'runtime:initial'
    });
  });

  it('writes runtime payload to repository and tombstones stale runtime rows when active', async () => {
    await promoteRuntimeState(runtimePayload({
      providers: [provider('provider-old')],
      activeProviderId: 'provider-old'
    }));

    await persistToDb(runtimePayload({
      providers: [provider('provider-new')],
      activeProviderId: 'provider-new'
    }));

    const legacyPayload = await kvGet('runtime-providers-v2');
    const staleRow = await kvGet(getLocalDataRowKey(getRuntimeObjectLocalDataRef('provider', 'provider-old')));
    const activeRow = await kvGet(getLocalDataRowKey(getRuntimeObjectLocalDataRef('provider', 'provider-new')));

    expect(legacyPayload).toBeNull();
    expect(staleRow).toEqual(expect.objectContaining({
      state: 'deleted'
    }));
    expect(activeRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        id: 'provider-new'
      })
    }));
  });

  it('first ordinary save on a fresh install writes LocalData rows and self-activates, never runtime-providers-v2', async () => {
    // A fresh install: no promotion, no active-data-source row, no rows.
    await expect(kvGet(getLocalDataActiveDataSourceKey())).resolves.toBeNull();

    await persistToDb(runtimePayload({
      providers: [provider('provider-fresh')],
      activeProviderId: 'provider-fresh'
    }));

    // The legacy whole-payload store is never written by an ordinary save.
    await expect(kvGet('runtime-providers-v2')).resolves.toBeNull();

    // LocalData runtime rows + the runtime commit pointer were written.
    const providerRow = await kvGet(getLocalDataRowKey(getRuntimeObjectLocalDataRef('provider', 'provider-fresh')));
    expect(providerRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({ id: 'provider-fresh' })
    }));
    await expect(kvGet(getLocalDataCommitPointerKey('runtime'))).resolves.toEqual(
      expect.objectContaining({ domain: 'runtime' })
    );

    // The runtime domain self-activated from its own committed rows: the active-data-source row
    // now points runtime at the repository (no migration validation report involved).
    const activeSource = (await kvGet(getLocalDataActiveDataSourceKey())) as LocalDataActiveDataSourceRow | null;
    expect(activeSource?.activeDataSource).toBe('repository');
    expect(activeSource?.domains.runtime).toEqual(expect.objectContaining({ domain: 'runtime' }));
  });

  it('reads the runtime payload back from active LocalData rows after a fresh-install save + reload', async () => {
    await persistToDb(runtimePayload({
      providers: [provider('provider-fresh')],
      activeProviderId: 'provider-fresh'
    }));

    const result = await hydrateFromDb({ throwOnReadFailure: true });

    // Runtime is now active, so hydrate reads from the repository rows (not the legacy KV) and
    // needs no rewrite.
    expect(result?.shouldPersist).toBe(false);
    expect(result?.payload).toEqual(expect.objectContaining({
      activeProviderId: 'provider-fresh',
      providers: [expect.objectContaining({ id: 'provider-fresh' })]
    }));
  });
});
