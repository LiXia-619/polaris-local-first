import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('collectionStorePersistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../infrastructure/persistenceDiagnostics', () => ({
      reportPersistenceError: vi.fn()
    }));
  });

  it('does not read legacy collection state during normal hydration', async () => {
    const kvGet = vi.fn(async () => {
      throw new Error('legacy collection KV should not be read');
    });
    vi.doMock('../infrastructure/persistence', () => ({ kvGet }));
    vi.doMock('./collection/localData', () => ({
      readCollectionStateFromLocalDataRepositoryIfActive: vi.fn(async () => null)
    }));

    const { readCollectionState } = await import('./collectionStorePersistence');
    const state = await readCollectionState();

    expect(state).toBeNull();
    expect(kvGet).not.toHaveBeenCalled();
  });

  it('throws in strict read mode when collection storage fails', async () => {
    const readError = new Error('db unavailable');
    vi.doMock('./collection/localData', () => ({
      readCollectionStateFromLocalDataRepositoryIfActive: vi.fn(async () => {
        throw readError;
      })
    }));

    const { readCollectionState } = await import('./collectionStorePersistence');

    await expect(readCollectionState({ throwOnReadFailure: true })).rejects.toBe(readError);
  });
});
