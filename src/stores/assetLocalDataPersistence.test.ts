import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildAssetLocalDataUnitOfWork,
  createLocalDataKvBackend,
  createLocalDataRepository,
  getAssetDomainMetaLocalDataRef,
  getAssetObjectLocalDataRef,
  getLocalDataActiveDataSourceKey,
  getLocalDataRowKey,
  LOCAL_DATA_SCHEMA_VERSION,
  type AssetDomainMetaRow,
  type AssetObjectRow,
  type LocalDataActiveDataSourceRow,
  type LocalDataCommitMeta,
  type LocalDataStoredRow
} from '../engines/localData';
import {
  ASSET_META_STORE,
  dbStoreGet,
  dbStoreSet,
  kvGet,
  kvSet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistedKvMutation,
  type PersistenceBackend
} from '../infrastructure/persistence';
import {
  deleteActiveAssetPreviewEntry,
  deleteAsset,
  getAssetBlob,
  getAssetMeta,
  replaceAssetEntries,
  saveAsset
} from '../infrastructure/assetStore';
import { sweepOrphanAssets } from '../engines/assetGovernance';
import type { AssetLocalDataState } from '../engines/localData/assetRows';

function createMemoryPersistenceBackend(): PersistenceBackend {
  const stores = new Map<string, Map<string, unknown>>();
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
        if (mutation.type === 'set') store.set(mutation.key, mutation.value);
        else store.delete(mutation.key);
      }
    },
    async kvReplaceAll(entries: PersistedDbEntry[]) {
      stores.set('kv', new Map(entries.map((entry) => [entry.key, entry.value])));
    }
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
      asset: { domain: 'asset', version: meta.version, committedAt: meta.committedAt, commitId: meta.commitId }
    }
  };
}

async function promoteAssetDomain(
  state: AssetLocalDataState = { meta: [], binary: [], preview: [], ownersByAssetId: new Map() }
) {
  const repository = createLocalDataRepository({
    backend: createLocalDataKvBackend(),
    now: () => 100,
    createCommitId: () => 'asset:initial'
  });
  const meta = await repository.commit(buildAssetLocalDataUnitOfWork({
    state,
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: 100
  }));
  await kvSet(getLocalDataActiveDataSourceKey(), activeSourceRow(meta));
}

function rawAssetRow(id: string) {
  return kvGet<LocalDataStoredRow<AssetObjectRow>>(getLocalDataRowKey(getAssetObjectLocalDataRef(id)));
}

async function readDomainMeta() {
  const row = await kvGet<LocalDataStoredRow<AssetDomainMetaRow>>(
    getLocalDataRowKey(getAssetDomainMetaLocalDataRef())
  );
  if (!row || row.state !== 'complete') throw new Error('asset domain meta is not complete');
  return row.value;
}

describe('asset row writer on the active asset domain', () => {
  beforeEach(() => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  it('writes a complete asset object row when an asset is saved while the domain is active', async () => {
    await promoteAssetDomain();

    await saveAsset({
      id: 'asset-1',
      kind: 'image',
      name: 'pic.png',
      mimeType: 'image/png',
      blob: new Blob(['the-image-bytes']),
      previewBlob: new Blob(['preview'])
    });

    const row = await rawAssetRow('asset-1');
    expect(row?.state).toBe('complete');
    const value = row?.state === 'complete' ? row.value : null;
    expect(value).toMatchObject({ id: 'asset-1', kind: 'image', hasMeta: true, hasBinary: true, hasPreview: true });
    // A freshly saved asset has no owner yet — orphan until something references it.
    expect(value?.orphan).toBe(true);

    // The active read path reads the row back, not the legacy meta store.
    expect(await getAssetMeta('asset-1')).toMatchObject({ id: 'asset-1', name: 'pic.png', kind: 'image' });

    const meta = await readDomainMeta();
    expect(meta.totalObjectCount).toBe(1);
    expect(meta.objectCounts.image).toBe(1);
    expect(meta.orphanObjectCount).toBe(1);
  });

  it('tombstones the asset row only on an explicit delete', async () => {
    await promoteAssetDomain();
    await saveAsset({ id: 'asset-1', kind: 'file', name: 'a.txt', mimeType: 'text/plain', blob: new Blob(['x']) });
    expect((await rawAssetRow('asset-1'))?.state).toBe('complete');

    await deleteAsset('asset-1');

    expect((await rawAssetRow('asset-1'))?.state).toBe('deleted');
    expect(await getAssetMeta('asset-1')).toBeNull();
    expect((await readDomainMeta()).totalObjectCount).toBe(0);
  });

  it('preserves an existing asset row on re-save (e.g. binary replaced)', async () => {
    await promoteAssetDomain();
    await saveAsset({ id: 'asset-1', kind: 'image', name: 'v1.png', mimeType: 'image/png', blob: new Blob(['v1']) });
    await saveAsset({ id: 'asset-1', kind: 'image', name: 'v2.png', mimeType: 'image/png', blob: new Blob(['v2-longer']) });

    const value = (await rawAssetRow('asset-1'));
    expect(value?.state === 'complete' && value.value.name).toBe('v2.png');
    expect((await readDomainMeta()).totalObjectCount).toBe(1);
  });

  it('getAssetMeta returns null for an id absent from the active row directory (no legacy fallback)', async () => {
    await promoteAssetDomain();
    // A legacy asset-meta entry exists for an id that has NO new-layer row.
    await dbStoreSet('asset-meta', 'legacy-only', {
      id: 'legacy-only', kind: 'image', name: 'old.png', mimeType: 'image/png', size: 5, createdAt: 1
    });

    // The active row directory is the only truth — the old asset is never read back as live.
    expect(await getAssetMeta('legacy-only')).toBeNull();
  });

  it('sweepOrphanAssets tombstones the orphan asset row under the active domain', async () => {
    await promoteAssetDomain();
    await saveAsset({ id: 'orphan-1', kind: 'image', name: 'o.png', mimeType: 'image/png', blob: new Blob(['x']) });
    expect((await rawAssetRow('orphan-1'))?.state).toBe('complete');

    const result = await sweepOrphanAssets({ conversations: [], imageCards: [] });

    expect(result.deletedAssetIds).toContain('orphan-1');
    expect((await rawAssetRow('orphan-1'))?.state).toBe('deleted');
    expect(await getAssetMeta('orphan-1')).toBeNull();
    expect((await readDomainMeta()).totalObjectCount).toBe(0);
  });

  it('clears the row preview fields when a redundant preview is deleted, keeping the asset', async () => {
    await promoteAssetDomain();
    await saveAsset({
      id: 'asset-1', kind: 'image', name: 'p.png', mimeType: 'image/png',
      blob: new Blob(['bin']), previewBlob: new Blob(['prev'])
    });
    const before = await rawAssetRow('asset-1');
    expect(before?.state === 'complete' && before.value.hasPreview).toBe(true);

    await deleteActiveAssetPreviewEntry('asset-1');

    const row = await rawAssetRow('asset-1');
    expect(row?.state).toBe('complete');
    expect(row?.state === 'complete' && row.value.hasPreview).toBe(false);
    expect(row?.state === 'complete' && row.value.previewBytes).toBe(0);
    // The asset survives — it still has meta + binary.
    expect(await getAssetMeta('asset-1')).toMatchObject({ id: 'asset-1' });
  });

  it('tombstones a preview-only asset row when its preview is deleted', async () => {
    await promoteAssetDomain({
      meta: [], binary: [], preview: [{ id: 'pv-only', bytes: 4 }], ownersByAssetId: new Map()
    });
    // A preview-only asset is an incomplete row (no meta, no binary).
    expect((await rawAssetRow('pv-only'))?.state).toBe('incomplete');

    await deleteActiveAssetPreviewEntry('pv-only');

    // With its only fact (the preview) gone, the row is tombstoned — not left claiming a preview.
    expect((await rawAssetRow('pv-only'))?.state).toBe('deleted');
    expect((await readDomainMeta()).totalObjectCount).toBe(0);
  });
});

describe('asset ordinary save first-write self-activation', () => {
  beforeEach(() => {
    setPersistenceBackendForTesting(createMemoryPersistenceBackend());
  });

  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  async function readActiveSource() {
    return await kvGet<LocalDataActiveDataSourceRow>(getLocalDataActiveDataSourceKey());
  }

  it('self-activates the asset domain on the first ordinary save of a fresh install', async () => {
    // Fresh install: no legacy asset entries, asset domain inactive.
    expect(await readActiveSource()).toBeNull();

    await saveAsset({
      id: 'asset-1', kind: 'image', name: 'pic.png', mimeType: 'image/png',
      blob: new Blob(['the-image-bytes']), previewBlob: new Blob(['preview'])
    });

    // The save wrote a complete asset row + domain meta and stamped the asset domain active.
    expect((await rawAssetRow('asset-1'))?.state).toBe('complete');
    const active = await readActiveSource();
    expect(active?.activeDataSource).toBe('repository');
    expect(active?.domains.asset?.commitId).toBeTruthy();

    // Product reads now come from the row directory; the binary blob stays the byte truth.
    expect(await getAssetMeta('asset-1')).toMatchObject({ id: 'asset-1', name: 'pic.png', kind: 'image' });
    expect(await dbStoreGet(ASSET_META_STORE, 'asset-1')).toBeNull();
    expect((await readDomainMeta()).totalObjectCount).toBe(1);
    expect(await getAssetBlob('asset-1')).not.toBeNull();
  });

  it('keeps self-activating on later saves once the domain is active (writes more rows)', async () => {
    await saveAsset({ id: 'asset-1', kind: 'file', name: 'a.txt', mimeType: 'text/plain', blob: new Blob(['a']) });
    await saveAsset({ id: 'asset-2', kind: 'file', name: 'b.txt', mimeType: 'text/plain', blob: new Blob(['b']) });

    expect((await rawAssetRow('asset-1'))?.state).toBe('complete');
    expect((await rawAssetRow('asset-2'))?.state).toBe('complete');
    expect(await dbStoreGet(ASSET_META_STORE, 'asset-1')).toBeNull();
    expect(await dbStoreGet(ASSET_META_STORE, 'asset-2')).toBeNull();
    expect((await readDomainMeta()).totalObjectCount).toBe(2);
  });

  it('does NOT self-activate when a legacy asset store entry already exists (no shadowing)', async () => {
    // Old install: a legacy asset-meta directory entry exists, asset domain inactive.
    await dbStoreSet('asset-meta', 'legacy-1', {
      id: 'legacy-1', kind: 'image', name: 'old.png', mimeType: 'image/png', size: 5, createdAt: 1
    });

    await saveAsset({ id: 'asset-2', kind: 'file', name: 'n.txt', mimeType: 'text/plain', blob: new Blob(['x']) });

    // The domain stayed inactive: no row, no active-data-source stamp.
    expect(await readActiveSource()).toBeNull();
    expect(await rawAssetRow('asset-2')).toBeNull();

    // Both the freshly saved asset and the old one stay readable through the legacy blob stores.
    expect(await getAssetMeta('asset-2')).toMatchObject({ id: 'asset-2', name: 'n.txt' });
    expect(await dbStoreGet(ASSET_META_STORE, 'asset-2')).toMatchObject({ id: 'asset-2', name: 'n.txt' });
    expect(await getAssetMeta('legacy-1')).toMatchObject({ id: 'legacy-1', name: 'old.png' });
  });

  it('import (replaceAssetEntries) never self-activates a fresh asset domain', async () => {
    await replaceAssetEntries([{
      meta: { id: 'imp-1', kind: 'image', name: 'i.png', mimeType: 'image/png', size: 3, createdAt: 1 },
      blob: new Blob(['imp']),
      previewBlob: null
    }]);

    // Import stays on the legacy blob stores; activation is the explicit restore boundary's job.
    expect(await readActiveSource()).toBeNull();
    expect(await rawAssetRow('imp-1')).toBeNull();
    expect(await getAssetMeta('imp-1')).toMatchObject({ id: 'imp-1' });
    expect(await dbStoreGet(ASSET_META_STORE, 'imp-1')).toMatchObject({ id: 'imp-1' });
  });
});
