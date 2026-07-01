import { afterEach, describe, expect, it } from 'vitest';
import type { StoredAssetMeta } from '../infrastructure/assetStore';
import type { ImageAssetCard } from '../types/domain';
import {
  ASSET_BINARY_STORE,
  ASSET_META_STORE,
  ASSET_PREVIEW_STORE,
  KV_STORE,
  kvGet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistedDbEntrySize,
  type PersistenceBackend
} from '../infrastructure/persistence';
import {
  getAssetObjectLocalDataRef,
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  type AssetObjectRow,
  type CommitPointerRow,
  type LocalDataCompleteRow
} from '../engines/localData';
import { commitAssetRowsMigrationFromCurrentPersistence } from './assetMigrationPersistence';

function createMemoryPersistenceBackend(args: {
  kv?: PersistedDbEntry[];
  assetMeta?: PersistedDbEntry<StoredAssetMeta>[];
  assetBinary?: PersistedDbEntry<Blob>[];
  assetPreview?: PersistedDbEntry<Blob>[];
  onEntriesRead?: (storeName: string) => void;
  entrySizes?: Record<string, PersistedDbEntrySize[]>;
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
      args.onEntriesRead?.(storeName);
      return Array.from(getStore(storeName).entries()).map(([key, value]) => ({ key, value: value as T }));
    },
    async dbStoreEntrySizes(storeName: string) {
      const configured = args.entrySizes?.[storeName];
      if (configured) return configured;
      return Array.from(getStore(storeName).entries()).map(([key, value]) => ({
        key,
        size: value instanceof Blob ? value.size : JSON.stringify(value)?.length ?? 0
      }));
    },
    async dbStoreKeys(storeName: string) {
      return Array.from(getStore(storeName).keys());
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

function meta(seed: Partial<StoredAssetMeta> & Pick<StoredAssetMeta, 'id'>): StoredAssetMeta {
  return {
    kind: 'image',
    name: `${seed.id}.png`,
    mimeType: 'image/png',
    size: 10,
    createdAt: 1,
    ...seed
  };
}

function image(seed: Partial<ImageAssetCard> & Pick<ImageAssetCard, 'id' | 'assetId'>): ImageAssetCard {
  return {
    title: seed.id,
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...seed
  };
}

afterEach(() => {
  setPersistenceBackendForTesting(null);
});

describe('commitAssetRowsMigrationFromCurrentPersistence', () => {
  it('commits asset rows with scanned owners without promoting activeDataSource', async () => {
    const asset = meta({ id: 'asset-image', name: 'hero.png', size: 5 });
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      kv: [
        {
          key: 'collection-state-v2',
          value: {
            cards: [],
            imageCards: [image({
              id: 'image-card-1',
              assetId: 'asset-image',
              title: 'Hero',
              ownerCollaboratorId: 'pharos'
            })],
            roomProjects: [],
            projectFiles: [],
            workspaceReferenceDocs: []
          }
        }
      ],
      assetMeta: [{ key: 'asset-image', value: asset }],
      assetBinary: [{ key: 'asset-image', value: new Blob(['image']) }],
      assetPreview: [{ key: 'asset-image', value: new Blob(['p']) }]
    }));

    const result = await commitAssetRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 100,
      unitId: 'asset-rows-test'
    });

    const assetRow = await kvGet<LocalDataCompleteRow<AssetObjectRow>>(
      getLocalDataRowKey(getAssetObjectLocalDataRef('asset-image'))
    );
    const pointer = await kvGet<CommitPointerRow>(getLocalDataCommitPointerKey('asset'));
    const activeDataSource = await kvGet(getLocalDataActiveDataSourceKey());

    expect(result.commitMeta).toEqual({
      domain: 'asset',
      version: 7,
      committedAt: 100,
      commitId: 'asset-rows-test'
    });
    expect(result.census).toEqual(expect.objectContaining({
      ok: true,
      sourceObjectCount: 1,
      activeObjectCount: 1,
      orphanObjectCount: 0,
      missingMetaCount: 0,
      missingBinaryCount: 0,
      previewOnlyCount: 0,
      expectedRepositoryRowCount: 2,
      actualRepositoryRowCount: 2,
      blockers: [],
      warnings: []
    }));
    expect(assetRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        id: 'asset-image',
        name: 'hero.png',
        hasBinary: true,
        hasPreview: true,
        binaryBytes: 5,
        previewBytes: 1,
        ownerRefs: [{
          kind: 'image-card',
          id: 'image-card-1',
          label: 'Hero'
        }]
      })
    }));
    expect(pointer).toEqual({
      domain: 'asset',
      version: 7,
      committedAt: 100,
      commitId: 'asset-rows-test'
    });
    expect(activeDataSource).toBeNull();
  });

  it('uses asset entry sizes without reading binary or preview blobs', async () => {
    const entriesRead: string[] = [];
    const asset = meta({ id: 'large-image', name: 'large.png', size: 900_000_000 });
    setPersistenceBackendForTesting(createMemoryPersistenceBackend({
      onEntriesRead: (storeName) => entriesRead.push(storeName),
      entrySizes: {
        [ASSET_BINARY_STORE]: [{ key: 'large-image', size: 900_000_000 }],
        [ASSET_PREVIEW_STORE]: [{ key: 'large-image', size: 18_000 }]
      },
      kv: [
        {
          key: 'collection-state-v2',
          value: {
            cards: [],
            imageCards: [image({
              id: 'image-card-large',
              assetId: 'large-image',
              title: 'Large image'
            })],
            roomProjects: [],
            projectFiles: [],
            workspaceReferenceDocs: []
          }
        }
      ],
      assetMeta: [{ key: 'large-image', value: asset }],
      assetBinary: [{
        key: 'large-image',
        value: new Blob(['binary payload should not be read'])
      }],
      assetPreview: [{
        key: 'large-image',
        value: new Blob(['preview payload should not be read'])
      }]
    }));

    await commitAssetRowsMigrationFromCurrentPersistence({
      version: 7,
      committedAt: 101,
      unitId: 'asset-rows-size-only-test'
    });

    const assetRow = await kvGet<LocalDataCompleteRow<AssetObjectRow>>(
      getLocalDataRowKey(getAssetObjectLocalDataRef('large-image'))
    );

    expect(entriesRead).not.toContain(ASSET_BINARY_STORE);
    expect(entriesRead).not.toContain(ASSET_PREVIEW_STORE);
    expect(assetRow?.value).toEqual(expect.objectContaining({
      binaryBytes: 900_000_000,
      previewBytes: 18_000
    }));
  });
});
