import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildRuntimeLocalDataUnitOfWork,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getLocalDataActiveDataSourceKey,
  getLocalDataRowKey,
  getRuntimeDomainMetaLocalDataRef,
  getRuntimeObjectLocalDataRef,
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataActiveDataSourceRow,
  type LocalDataCommitMeta,
  type LocalDataStoredRow,
  type RuntimeDomainMetaRow,
  type RuntimeLocalDataObjectKind,
  type RuntimeObjectRow
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
import {
  commitRuntimeRowChangesFromStateIfActive,
  commitRuntimeRowChangesIfActive
} from './runtimeLocalDataPersistence';
import type { RuntimePayload } from './runtimeStorePersistence';
import { DEFAULT_RUNTIME_TOOLBOX_STATE } from './runtimeStoreToolbox';
import { DEFAULT_RUNTIME_TRIGGER_STATE } from './runtimeStoreTriggers';
import { DEFAULT_VOICE_GENERATION_SETTINGS } from './runtimeStoreVoiceGeneration';
import { DEFAULT_WEBDAV_CONFIG } from './runtimeStoreWebDav';

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

function activeSourceRow(meta: LocalDataCommitMeta): LocalDataActiveDataSourceRow {
  return {
    schemaVersion: LOCAL_DATA_SCHEMA_VERSION,
    key: getLocalDataActiveDataSourceKey(),
    activeDataSource: 'repository',
    activeCommitId: meta.commitId,
    stagingCommitId: null,
    updatedAt: meta.committedAt,
    domains: {
      runtime: { domain: 'runtime', version: meta.version, committedAt: meta.committedAt, commitId: meta.commitId }
    }
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

function rawObjectRow(kind: RuntimeLocalDataObjectKind, id: string) {
  return kvGet<LocalDataStoredRow<RuntimeObjectRow<RuntimeLocalDataObjectKind>>>(
    getLocalDataRowKey(getRuntimeObjectLocalDataRef(kind, id))
  );
}

async function readObjectValue(kind: RuntimeLocalDataObjectKind, id: string) {
  const row = await rawObjectRow(kind, id);
  if (!row || row.state !== 'complete') throw new Error(`${kind}:${id} is not complete`);
  return row.value;
}

async function readDomainMeta() {
  const row = await kvGet<LocalDataStoredRow<RuntimeDomainMetaRow>>(
    getLocalDataRowKey(getRuntimeDomainMetaLocalDataRef())
  );
  if (!row || row.state !== 'complete') throw new Error('runtime domain meta is not complete');
  return row.value;
}

describe('runtime row writer', () => {
  beforeEach(() => {
    commitCount = 0;
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  it('upserts one provider without rewriting unrelated rows', async () => {
    await promoteRuntimeState(runtimePayload({
      providers: [provider('provider-a'), provider('provider-b')],
      activeProviderId: 'provider-a'
    }));
    const settingsBefore = await rawObjectRow('settings', 'runtime-settings');
    const providerBBefore = await rawObjectRow('provider', 'provider-b');
    commitCount = 0;

    const wrote = await commitRuntimeRowChangesIfActive({
      changes: [{ type: 'upsert', kind: 'provider', value: { ...provider('provider-a'), model: 'model-z' } }],
      activeProviderId: 'provider-a'
    });

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readObjectValue('provider', 'provider-a')).value).toEqual(expect.objectContaining({ model: 'model-z' }));
    // The settings singleton and the other provider were not in the change set.
    expect(await rawObjectRow('settings', 'runtime-settings')).toEqual(settingsBefore);
    expect(await rawObjectRow('provider', 'provider-b')).toEqual(providerBBefore);
    const meta = await readDomainMeta();
    expect(meta.objectCounts.provider).toBe(2);
    expect(meta.activeProviderId).toBe('provider-a');
  });

  it('commits a domain-meta-only active-provider change with no object change', async () => {
    await promoteRuntimeState(runtimePayload({
      providers: [provider('provider-a'), provider('provider-b')],
      activeProviderId: 'provider-a'
    }));
    commitCount = 0;

    // Only the active pointer moved; the provider rows carry no active flag, so the object
    // value diff is empty — the meta change must still commit.
    const wrote = await commitRuntimeRowChangesFromStateIfActive(runtimePayload({
      providers: [provider('provider-a'), provider('provider-b')],
      activeProviderId: 'provider-b'
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readDomainMeta()).activeProviderId).toBe('provider-b');
  });

  it('upserts the settings singleton on a settings field change', async () => {
    await promoteRuntimeState(runtimePayload({ taskModeEnabled: false }));
    const providerBefore = await rawObjectRow('provider', 'provider-1');
    commitCount = 0;

    const wrote = await commitRuntimeRowChangesFromStateIfActive(runtimePayload({ taskModeEnabled: true }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(1);
    expect((await readObjectValue('settings', 'runtime-settings')).value).toEqual(
      expect.objectContaining({ taskModeEnabled: true })
    );
    // The unrelated provider row is untouched.
    expect(await rawObjectRow('provider', 'provider-1')).toEqual(providerBefore);
  });

  it('tombstones a removed provider and drops it from the counts', async () => {
    await promoteRuntimeState(runtimePayload({
      providers: [provider('provider-a'), provider('provider-b')],
      activeProviderId: 'provider-a'
    }));
    commitCount = 0;

    const wrote = await commitRuntimeRowChangesFromStateIfActive(runtimePayload({
      providers: [provider('provider-a')],
      activeProviderId: 'provider-a'
    }));

    expect(wrote).toBe(true);
    expect((await rawObjectRow('provider', 'provider-b'))?.state).toBe('deleted');
    expect((await rawObjectRow('provider', 'provider-a'))?.state).toBe('complete');
    expect((await readDomainMeta()).objectCounts.provider).toBe(1);
  });

  it('does not commit when only the synthetic write-time stamp would differ', async () => {
    const payload = runtimePayload({ providers: [provider('provider-a')], activeProviderId: 'provider-a' });
    await promoteRuntimeState(payload);
    commitCount = 0;

    const wrote = await commitRuntimeRowChangesFromStateIfActive(runtimePayload({
      providers: [provider('provider-a')],
      activeProviderId: 'provider-a'
    }));

    expect(wrote).toBe(true);
    expect(commitCount).toBe(0);
  });

  it('throws when a change set writes the same object twice', async () => {
    await promoteRuntimeState(runtimePayload());
    commitCount = 0;

    await expect(commitRuntimeRowChangesIfActive({
      changes: [
        { type: 'upsert', kind: 'provider', value: provider('provider-x') },
        { type: 'delete', kind: 'provider', id: 'provider-x' }
      ],
      activeProviderId: 'provider-1'
    })).rejects.toThrow(/same object twice/);
    expect(commitCount).toBe(0);
  });

  it('returns false without writing when the runtime repository is inactive', async () => {
    const wrote = await commitRuntimeRowChangesIfActive({
      changes: [{ type: 'upsert', kind: 'provider', value: provider('provider-a') }],
      activeProviderId: 'provider-a'
    });
    expect(wrote).toBe(false);
    expect(commitCount).toBe(0);
  });
});
