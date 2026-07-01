import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistenceMocks = vi.hoisted(() => ({
  deleteActiveAssetPreviewEntry: vi.fn(),
  deleteActiveAssetStorageEntries: vi.fn(),
  dbStoreDelete: vi.fn(),
  dbStoreEntries: vi.fn(),
  dbStoreEntrySizes: vi.fn(),
  dbStoreKeys: vi.fn()
}));

vi.mock('../infrastructure/persistence', () => ({
  ASSET_BINARY_STORE: 'asset-binary',
  ASSET_META_STORE: 'asset-meta',
  ASSET_PREVIEW_STORE: 'asset-preview',
  dbStoreDelete: persistenceMocks.dbStoreDelete,
  dbStoreEntries: persistenceMocks.dbStoreEntries,
  dbStoreEntrySizes: persistenceMocks.dbStoreEntrySizes,
  dbStoreKeys: persistenceMocks.dbStoreKeys
}));

vi.mock('../infrastructure/assetStore', () => ({
  deleteActiveAssetPreviewEntry: persistenceMocks.deleteActiveAssetPreviewEntry,
  deleteActiveAssetStorageEntries: persistenceMocks.deleteActiveAssetStorageEntries,
  listActiveAssetBinaryEntrySizes: vi.fn(async () => []),
  listActiveAssetBinaryKeys: async () => await persistenceMocks.dbStoreKeys('asset-binary'),
  listActiveAssetMetaEntries: persistenceMocks.dbStoreEntries,
  listActiveAssetPreviewEntrySizes: async () => await persistenceMocks.dbStoreEntrySizes('asset-preview'),
  runExclusiveAssetMutation: async <T>(operation: () => Promise<T>) => await operation()
}));

describe('sweepOrphanAssets', () => {
  beforeEach(() => {
    persistenceMocks.dbStoreDelete.mockReset();
    persistenceMocks.deleteActiveAssetPreviewEntry.mockReset();
    persistenceMocks.deleteActiveAssetStorageEntries.mockReset();
    persistenceMocks.dbStoreEntries.mockReset();
    persistenceMocks.dbStoreEntrySizes.mockReset();
    persistenceMocks.dbStoreKeys.mockReset();
  });

  it('deletes only the orphan assets included in the confirmed candidate set without reading binary payloads', async () => {
    persistenceMocks.dbStoreEntries.mockImplementation(async (storeName: string) => {
      if (storeName === 'asset-meta') {
        return [
          {
            key: 'asset-confirmed-orphan',
            value: {
              id: 'asset-confirmed-orphan',
              kind: 'image',
              name: 'old.png',
              mimeType: 'image/png',
              size: 4,
              createdAt: 1
            }
          },
          {
            key: 'asset-new-orphan',
            value: {
              id: 'asset-new-orphan',
              kind: 'image',
              name: 'new.png',
              mimeType: 'image/png',
              size: 4,
              createdAt: 2
            }
          }
        ];
      }
      if (storeName === 'asset-binary' || storeName === 'asset-preview') {
        throw new Error(`binary payloads should not be read from ${storeName}`);
      }
      return [];
    });
    persistenceMocks.dbStoreKeys.mockImplementation(async (storeName: string) => {
      if (storeName === 'asset-binary') {
        return ['asset-confirmed-orphan', 'asset-new-orphan'];
      }
      return [];
    });
    persistenceMocks.dbStoreEntrySizes.mockImplementation(async (storeName: string) => {
      if (storeName === 'asset-preview') {
        return [
          { key: 'preview-confirmed-orphan', size: 7 },
          { key: 'preview-new-orphan', size: 7 }
        ];
      }
      return [];
    });

    const { sweepOrphanAssets } = await import('./assetGovernance');
    const result = await sweepOrphanAssets({
      conversations: [],
      imageCards: []
    }, {
      candidateAssetIds: ['asset-confirmed-orphan'],
      candidatePreviewCacheIds: ['preview-confirmed-orphan']
    });

    expect(result.deletedAssetIds).toEqual(['asset-confirmed-orphan']);
    expect(result.deletedPreviewCacheIds).toEqual(['preview-confirmed-orphan']);
    expect(persistenceMocks.deleteActiveAssetStorageEntries).toHaveBeenCalledWith('asset-confirmed-orphan');
    expect(persistenceMocks.deleteActiveAssetPreviewEntry).toHaveBeenCalledWith('preview-confirmed-orphan');
    expect(persistenceMocks.deleteActiveAssetStorageEntries).not.toHaveBeenCalledWith('asset-new-orphan');
    expect(persistenceMocks.deleteActiveAssetPreviewEntry).not.toHaveBeenCalledWith('preview-new-orphan');
    expect(persistenceMocks.dbStoreEntrySizes).toHaveBeenCalledTimes(1);
  });
});
