import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistenceMocks = vi.hoisted(() => ({
  dbStoreEntries: vi.fn(),
  dbStoreEntrySizes: vi.fn(),
  dbStoreKeys: vi.fn(),
  getPersistenceStorageDiagnostic: vi.fn(),
  kvEntries: vi.fn(),
  kvEntrySizes: vi.fn(),
  kvGet: vi.fn(),
  kvKeysWithPrefix: vi.fn()
}));

vi.mock('./persistence', () => ({
  ASSET_BINARY_STORE: 'asset-binary',
  ASSET_META_STORE: 'asset-meta',
  ASSET_PREVIEW_STORE: 'asset-preview',
  dbStoreEntries: persistenceMocks.dbStoreEntries,
  dbStoreEntrySizes: persistenceMocks.dbStoreEntrySizes,
  dbStoreKeys: persistenceMocks.dbStoreKeys,
  getPersistenceStorageDiagnostic: persistenceMocks.getPersistenceStorageDiagnostic,
  kvEntries: persistenceMocks.kvEntries,
  kvEntrySizes: persistenceMocks.kvEntrySizes,
  kvGet: persistenceMocks.kvGet,
  kvKeysWithPrefix: persistenceMocks.kvKeysWithPrefix
}));

describe('readLocalDataHealthSnapshot', () => {
  beforeEach(async () => {
    vi.resetModules();
    Object.values(persistenceMocks).forEach((mock) => mock.mockReset());
    // Asset health probes LocalData asset activity through the store backend host. Health runs
    // against an inactive repository here, so install an inactive backend after resetModules
    // instead of relying on the partial persistence mock.
    const { installStoreLocalDataBackend } = await import('../stores/storeLocalDataBackendHost');
    installStoreLocalDataBackend({
      mode: 'transactional',
      read: async () => null,
      listKeysWithPrefix: async () => [],
      commitAtomic: async () => {}
    });
    persistenceMocks.kvEntries.mockRejectedValue(new Error('default health must not read full kv entries'));
    persistenceMocks.kvEntrySizes.mockResolvedValue([
      { key: 'chat-commit-pointer-v1', size: 80 },
      { key: 'chat-manifest-v1:commit-current', size: 140 },
      { key: 'chat-messages-v2:large-history', size: 900_000_000 },
      { key: 'persona-memory-doc-content-v3:pharos:huge:0', size: 25_000_000 },
      { key: 'collection-state-v2', size: 300 }
    ]);
    persistenceMocks.kvGet.mockImplementation(async (key: string) => {
      if (key === 'local-data-v1:active-data-source') {
        return null;
      }
      if (key === 'chat-commit-pointer-v1') {
        return { schemaVersion: 1, currentCommitId: 'commit-current' };
      }
      if (key === 'chat-manifest-v1:commit-current') {
        return { schemaVersion: 1, commitId: 'commit-current', conversations: [] };
      }
      if (key === 'collection-state-v2') {
        return { cards: [], imageCards: [], projectFiles: [], roomProjects: [], workspaceReferenceDocs: [] };
      }
      throw new Error(`unexpected kvGet ${key}`);
    });
    persistenceMocks.kvKeysWithPrefix.mockResolvedValue([]);
    persistenceMocks.dbStoreEntries.mockImplementation(async (storeName: string) => {
      if (storeName === 'asset-meta') return [];
      throw new Error(`default health must not read ${storeName} entries`);
    });
    persistenceMocks.dbStoreKeys.mockResolvedValue([]);
    persistenceMocks.dbStoreEntrySizes.mockResolvedValue([]);
    persistenceMocks.getPersistenceStorageDiagnostic.mockResolvedValue({
      mode: 'android-native-indexeddb-bridge',
      label: 'Android 原生存储',
      detail: '测试'
    });
  });

  it('uses kv sizes and selected metadata instead of reading full kv payloads', async () => {
    const { readLocalDataHealthSnapshot } = await import('./localDataHealth');

    const snapshot = await readLocalDataHealthSnapshot();

    expect(snapshot.buckets.find((bucket) => bucket.id === 'chat')?.bytes).toBeGreaterThan(900_000_000);
    expect(persistenceMocks.kvEntries).not.toHaveBeenCalled();
    expect(persistenceMocks.kvEntrySizes).toHaveBeenCalledTimes(1);
    expect(persistenceMocks.kvGet).toHaveBeenCalledWith('chat-commit-pointer-v1');
    expect(persistenceMocks.kvGet).toHaveBeenCalledWith('chat-manifest-v1:commit-current');
    expect(persistenceMocks.kvGet).not.toHaveBeenCalledWith('chat-messages-v2:large-history');
    expect(persistenceMocks.kvGet).not.toHaveBeenCalledWith('persona-memory-doc-content-v3:pharos:huge:0');
  });

  it('reads promotion readiness evidence without loading legacy body payloads', async () => {
    const localDataRow = {
      schemaVersion: 1,
      key: 'local-data-v1:row:runtime:domainMeta:runtime',
      ref: { domain: 'runtime', kind: 'domainMeta', id: 'runtime' },
      version: 1,
      updatedAt: 100,
      state: 'complete',
      value: { id: 'runtime' }
    };
    persistenceMocks.kvEntrySizes.mockResolvedValue([
      { key: 'local-data-v1:pointer:runtime', size: 80 },
      { key: localDataRow.key, size: 200 },
      { key: 'chat-messages-v2:large-history', size: 900_000_000 },
      { key: 'persona-memory-doc-content-v3:pharos:huge:0', size: 25_000_000 }
    ]);
    persistenceMocks.kvGet.mockImplementation(async (key: string) => {
      if (key === 'local-data-v1:pointer:runtime') {
        return { domain: 'runtime', version: 1, committedAt: 100, commitId: 'runtime-commit' };
      }
      if (key === localDataRow.key) return localDataRow;
      throw new Error(`unexpected kvGet ${key}`);
    });

    const { readLocalDataPromotionReadinessKvEntries } = await import('./localDataHealth');

    const entries = await readLocalDataPromotionReadinessKvEntries();

    expect(persistenceMocks.kvEntries).not.toHaveBeenCalled();
    expect(persistenceMocks.kvEntrySizes).toHaveBeenCalledTimes(1);
    expect(persistenceMocks.kvGet).toHaveBeenCalledWith('local-data-v1:pointer:runtime');
    expect(persistenceMocks.kvGet).toHaveBeenCalledWith(localDataRow.key);
    expect(persistenceMocks.kvGet).not.toHaveBeenCalledWith('chat-messages-v2:large-history');
    expect(persistenceMocks.kvGet).not.toHaveBeenCalledWith('persona-memory-doc-content-v3:pharos:huge:0');
    expect(entries).toEqual(expect.arrayContaining([
      { key: 'chat-messages-v2:large-history', value: undefined },
      { key: localDataRow.key, value: localDataRow }
    ]));
  });
});
