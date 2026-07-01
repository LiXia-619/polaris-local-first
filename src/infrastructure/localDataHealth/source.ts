import {
  getPersistenceStorageDiagnostic,
  kvEntries,
  kvEntrySizes,
  kvGet,
  type PersistedDbEntry,
  type PersistedDbEntrySize,
  type PersistenceStorageDiagnostic
} from '../persistence';
import {
  listActiveAssetBinaryEntries,
  listActiveAssetBinaryEntrySizes,
  listActiveAssetBinaryKeys,
  listActiveAssetMetaEntries,
  listActiveAssetPreviewEntries,
  listActiveAssetPreviewEntrySizes,
  listActiveAssetPreviewKeys,
  type StoredAssetMeta
} from '../assetStore';
import { LOCAL_DATA_LIVE_PROMOTION_RESULT_KEY } from '../../engines/localData/livePromotionSummary';
import {
  CHAT_CATALOG_KEY,
  CHAT_COMMIT_POINTER_KEY,
  CHAT_CONVERSATION_RECORD_PREFIX,
  CHAT_INDEX_KEY,
  CHAT_INDEX_PENDING_KEY,
  CHAT_MANIFEST_PREFIX,
  COLLECTION_STATE_KEY,
  LOCAL_DATA_ROW_PREFIX,
  PERSONA_STATE_KEY,
  RUNTIME_STATE_KEY
} from './storageKeys';

export type LocalStorageEntry = {
  key: string;
  value: string;
};

export type LocalDataHealthSource = {
  now?: number;
  kv: PersistedDbEntry[];
  kvSizes?: PersistedDbEntrySize[];
  assetMeta: PersistedDbEntry<StoredAssetMeta>[];
  assetBinary?: PersistedDbEntry<Blob>[];
  assetPreview?: PersistedDbEntry<Blob>[];
  assetBinarySizes?: PersistedDbEntrySize[];
  assetPreviewSizes?: PersistedDbEntrySize[];
  assetBinaryKeys?: string[];
  assetPreviewKeys?: string[];
  localStorage: LocalStorageEntry[];
  storage?: PersistenceStorageDiagnostic;
};

export type LocalDataHealthReadMode = 'metadata' | 'full';

const LIGHTWEIGHT_KV_EXACT_KEYS = new Set([
  CHAT_COMMIT_POINTER_KEY,
  CHAT_INDEX_KEY,
  CHAT_INDEX_PENDING_KEY,
  CHAT_CATALOG_KEY,
  COLLECTION_STATE_KEY,
  PERSONA_STATE_KEY,
  RUNTIME_STATE_KEY,
  'runtime-api-v1',
  'space-theme-state-v1',
  'local-data-v1:active-data-source',
  LOCAL_DATA_LIVE_PROMOTION_RESULT_KEY
]);
const LIGHTWEIGHT_KV_PREFIXES = [
  CHAT_MANIFEST_PREFIX,
  CHAT_CONVERSATION_RECORD_PREFIX,
  'local-data-v1:row:persona:',
  'local-data-v1:pointer:',
  'local-data-v1:migration-validation-report:'
];

export function readLocalStorageEntries(): LocalStorageEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const storage = window.localStorage;
    const entries: LocalStorageEntry[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;
      entries.push({
        key,
        value: storage.getItem(key) ?? ''
      });
    }
    return entries;
  } catch {
    return [];
  }
}

function shouldReadKvValueForLightweightHealth(key: string) {
  return LIGHTWEIGHT_KV_EXACT_KEYS.has(key)
    || LIGHTWEIGHT_KV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function shouldReadKvValueForPromotionReadiness(key: string) {
  return shouldReadKvValueForLightweightHealth(key) || key.startsWith(LOCAL_DATA_ROW_PREFIX);
}

async function readSizedKvEntriesWithSelectedValues(
  shouldReadValue: (key: string) => boolean
): Promise<{
  kv: PersistedDbEntry[];
  kvSizes: PersistedDbEntrySize[];
}> {
  const sizes = await kvEntrySizes();
  const valueByKey = new Map<string, unknown>();
  await Promise.all(sizes
    .map((entry) => entry.key)
    .filter(shouldReadValue)
    .map(async (key) => {
      try {
        valueByKey.set(key, await kvGet(key));
      } catch {
        valueByKey.set(key, undefined);
      }
    }));

  return {
    kv: sizes.map((entry) => ({
      key: entry.key,
      value: valueByKey.get(entry.key)
    })),
    kvSizes: sizes
  };
}

async function readLightweightKvEntries(): Promise<{
  kv: PersistedDbEntry[];
  kvSizes: PersistedDbEntrySize[];
}> {
  return readSizedKvEntriesWithSelectedValues(shouldReadKvValueForLightweightHealth);
}

export async function readLocalDataPromotionReadinessKvEntries(): Promise<PersistedDbEntry[]> {
  return (await readSizedKvEntriesWithSelectedValues(shouldReadKvValueForPromotionReadiness)).kv;
}

export async function readLocalDataHealthSource(mode: LocalDataHealthReadMode = 'metadata'): Promise<LocalDataHealthSource> {
  const [
    kvSource,
    assetMeta,
    assetBinary,
    assetPreview,
    assetBinarySizes,
    assetPreviewSizes,
    storage
  ] = await Promise.all([
    mode === 'full' ? kvEntries().then((kv) => ({ kv, kvSizes: undefined })) : readLightweightKvEntries(),
    listActiveAssetMetaEntries(),
    mode === 'full' ? listActiveAssetBinaryEntries() : listActiveAssetBinaryKeys(),
    mode === 'full' ? listActiveAssetPreviewEntries() : listActiveAssetPreviewKeys(),
    mode === 'full' ? Promise.resolve(undefined) : listActiveAssetBinaryEntrySizes(),
    mode === 'full' ? Promise.resolve(undefined) : listActiveAssetPreviewEntrySizes(),
    getPersistenceStorageDiagnostic()
  ]);

  return {
    kv: kvSource.kv,
    ...(kvSource.kvSizes ? { kvSizes: kvSource.kvSizes } : {}),
    assetMeta,
    ...(mode === 'full'
      ? {
          assetBinary: assetBinary as PersistedDbEntry<Blob>[],
          assetPreview: assetPreview as PersistedDbEntry<Blob>[]
        }
      : {
          assetBinarySizes,
          assetPreviewSizes,
          assetBinaryKeys: assetBinary as string[],
          assetPreviewKeys: assetPreview as string[]
        }),
    localStorage: readLocalStorageEntries(),
    storage
  };
}
