import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  LocalDataBackendMutation,
  LocalDataCommitMeta,
  LocalDataTransactionalBackend
} from '../engines/localData';
import { clearLegacyLocalDataKvShadowIfStoreBackendInstalled } from './localDataLegacyKvShadowCleanup';
import {
  installStoreLocalDataBackend,
  resetStoreLocalDataBackendForTesting
} from './storeLocalDataBackendHost';

const persistenceMocks = vi.hoisted(() => ({
  kvApplyMutations: vi.fn(),
  kvKeysWithPrefix: vi.fn()
}));

vi.mock('../infrastructure/persistence', () => ({
  kvApplyMutations: persistenceMocks.kvApplyMutations,
  kvKeysWithPrefix: persistenceMocks.kvKeysWithPrefix
}));

function createInstalledBackend(): LocalDataTransactionalBackend {
  return {
    mode: 'transactional',
    async read() {
      return null;
    },
    async listKeysWithPrefix() {
      return [];
    },
    async commitAtomic(_mutations: LocalDataBackendMutation[], _meta: LocalDataCommitMeta) {}
  };
}

afterEach(() => {
  resetStoreLocalDataBackendForTesting();
  persistenceMocks.kvApplyMutations.mockReset();
  persistenceMocks.kvKeysWithPrefix.mockReset();
});

describe('clearLegacyLocalDataKvShadowIfStoreBackendInstalled', () => {
  it('deletes raw KV LocalData keys after a dedicated store backend is installed', async () => {
    installStoreLocalDataBackend(createInstalledBackend());
    persistenceMocks.kvKeysWithPrefix.mockResolvedValue([
      'local-data-v1:active-data-source',
      'local-data-v1:row:chat:domainMeta:chat'
    ]);

    await expect(clearLegacyLocalDataKvShadowIfStoreBackendInstalled()).resolves.toEqual({
      cleared: true,
      deletedKeyCount: 2
    });

    expect(persistenceMocks.kvKeysWithPrefix).toHaveBeenCalledWith('local-data-v1:');
    expect(persistenceMocks.kvApplyMutations).toHaveBeenCalledWith([
      { type: 'delete', key: 'local-data-v1:active-data-source' },
      { type: 'delete', key: 'local-data-v1:row:chat:domainMeta:chat' }
    ]);
  });

  it('leaves raw KV LocalData untouched when KV is the current store backend', async () => {
    persistenceMocks.kvKeysWithPrefix.mockResolvedValue([
      'local-data-v1:active-data-source'
    ]);

    await expect(clearLegacyLocalDataKvShadowIfStoreBackendInstalled()).resolves.toEqual({
      cleared: false,
      deletedKeyCount: 0
    });

    expect(persistenceMocks.kvKeysWithPrefix).not.toHaveBeenCalled();
    expect(persistenceMocks.kvApplyMutations).not.toHaveBeenCalled();
  });
});
