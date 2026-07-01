import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installStoreLocalDataBackend,
  resetStoreLocalDataBackendForTesting
} from '../stores/storeLocalDataBackendHost';

const persistenceMocks = vi.hoisted(() => ({
  dbStoreClear: vi.fn(),
  dbStoreDelete: vi.fn(),
  dbStoreEntries: vi.fn(),
  dbStoreEntrySizes: vi.fn(),
  dbStoreGet: vi.fn(),
  dbStoreKeys: vi.fn(),
  dbStoreSet: vi.fn(),
  kvGet: vi.fn(),
  kvKeysWithPrefix: vi.fn()
}));

vi.mock('./persistence', () => ({
  ASSET_BINARY_STORE: 'asset-binary',
  ASSET_META_STORE: 'asset-meta',
  ASSET_PREVIEW_STORE: 'asset-preview',
  dbStoreClear: persistenceMocks.dbStoreClear,
  dbStoreDelete: persistenceMocks.dbStoreDelete,
  dbStoreEntries: persistenceMocks.dbStoreEntries,
  dbStoreEntrySizes: persistenceMocks.dbStoreEntrySizes,
  dbStoreGet: persistenceMocks.dbStoreGet,
  dbStoreKeys: persistenceMocks.dbStoreKeys,
  dbStoreSet: persistenceMocks.dbStoreSet,
  kvGet: persistenceMocks.kvGet,
  kvKeysWithPrefix: persistenceMocks.kvKeysWithPrefix
}));

afterEach(() => {
  vi.unstubAllGlobals();
  Object.values(persistenceMocks).forEach((mock) => mock.mockReset());
  resetStoreLocalDataBackendForTesting();
});

describe('assetStore', () => {
  beforeEach(() => {
    // These unit tests exercise the legacy blob-store surface of an install where LocalData is NOT the
    // active asset source. A preexisting legacy entry keeps an ordinary save on the legacy stores and
    // declines self-activation (fresh-install first-write self-activation is covered against a real
    // backend in assetLocalDataPersistence.test.ts).
    persistenceMocks.kvGet.mockResolvedValue(null);
    persistenceMocks.dbStoreKeys.mockResolvedValue(['asset-legacy']);
    // The asset active-source check now reads through the store backend host; install an inactive
    // backend so it reports "LocalData inactive" without constructing a KV backend against the
    // partial persistence mock.
    installStoreLocalDataBackend({
      mode: 'transactional',
      read: async () => null,
      listKeysWithPrefix: async () => [],
      commitAtomic: async () => {}
    });
  });

  it('writes asset metadata only after binary and preview data are stored', async () => {
    const calls: string[] = [];
    persistenceMocks.dbStoreSet.mockImplementation(async (storeName: string) => {
      calls.push(`set:${storeName}`);
    });

    const { saveAsset } = await import('./assetStore');
    await saveAsset({
      id: 'asset-1',
      kind: 'image',
      name: 'image.png',
      mimeType: 'image/png',
      blob: new Blob(['image']),
      previewBlob: new Blob(['preview'])
    });

    expect(calls).toEqual([
      'set:asset-binary',
      'set:asset-preview',
      'set:asset-meta'
    ]);
  });

  it('does not publish metadata when binary storage fails', async () => {
    persistenceMocks.dbStoreSet.mockImplementation(async (storeName: string) => {
      if (storeName === 'asset-binary') {
        throw new Error('binary failed');
      }
    });

    const { saveAsset } = await import('./assetStore');
    await expect(saveAsset({
      id: 'asset-1',
      kind: 'file',
      name: 'note.txt',
      mimeType: 'text/plain',
      blob: new Blob(['note'])
    })).rejects.toThrow('binary failed');

    expect(persistenceMocks.dbStoreSet).not.toHaveBeenCalledWith(
      'asset-meta',
      expect.any(String),
      expect.anything()
    );
  });

  it('decodes legacy asset snapshots before clearing current asset stores', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('bad data url');
    }));

    const { replaceAssetSnapshot } = await import('./assetStore');
    await expect(replaceAssetSnapshot([{
      id: 'asset-1',
      kind: 'image',
      name: 'broken.png',
      mimeType: 'image/png',
      size: 0,
      createdAt: 1,
      dataUrl: 'data:image/png;base64,broken'
    }])).rejects.toThrow('bad data url');

    expect(persistenceMocks.dbStoreClear).not.toHaveBeenCalled();
  });

  it('writes replacement assets as stable cache entries without clearing or switching active truth', async () => {
    const calls: string[] = [];
    persistenceMocks.kvGet.mockResolvedValue(null);
    persistenceMocks.dbStoreSet.mockImplementation(async (storeName: string, key: string) => {
      calls.push(`set:${storeName}:${key}`);
    });
    persistenceMocks.dbStoreDelete.mockImplementation(async (storeName: string, key: string) => {
      calls.push(`delete:${storeName}:${key}`);
    });

    const { replaceAssetEntries } = await import('./assetStore');
    await replaceAssetEntries([{
      meta: {
        id: 'asset-new',
        kind: 'image',
        name: 'new.png',
        mimeType: 'image/png',
        size: 3,
        createdAt: 1
      },
      blob: new Blob(['new']),
      previewBlob: null
    }]);

    expect(persistenceMocks.dbStoreClear).not.toHaveBeenCalled();
    const binaryCallIndex = calls.findIndex((call) => call === 'set:asset-binary:asset-new');
    const metaCallIndex = calls.findIndex((call) => call === 'set:asset-meta:asset-new');
    expect(binaryCallIndex).toBeGreaterThanOrEqual(0);
    expect(metaCallIndex).toBeGreaterThan(binaryCallIndex);
    expect(calls.some((call) => call.startsWith('kv:'))).toBe(false);
  });

  it('does not publish replacement metadata when binary cache write fails', async () => {
    persistenceMocks.kvGet.mockResolvedValue(null);
    persistenceMocks.dbStoreSet.mockImplementation(async (storeName: string) => {
      if (storeName === 'asset-binary') {
        throw new Error('binary failed');
      }
    });

    const { replaceAssetEntries } = await import('./assetStore');
    await expect(replaceAssetEntries([{
      meta: {
        id: 'asset-new',
        kind: 'file',
        name: 'new.txt',
        mimeType: 'text/plain',
        size: 3,
        createdAt: 1
      },
      blob: new Blob(['new']),
      previewBlob: null
    }])).rejects.toThrow('binary failed');

    expect(persistenceMocks.dbStoreClear).not.toHaveBeenCalled();
    expect(persistenceMocks.dbStoreSet).not.toHaveBeenCalledWith(
      'asset-meta',
      expect.any(String),
      expect.anything()
    );
  });
});
