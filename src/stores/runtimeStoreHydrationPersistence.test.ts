import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtimeStorePersistence hydration persistence repair', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../infrastructure/persistenceDiagnostics', () => ({
      reportPersistenceError: vi.fn()
    }));
  });

  // Runtime hydrate checks LocalData repository activity through the store backend host. These
  // legacy-repair scenarios run against an inactive repository, so install an inactive backend
  // (after the persistence doMock) instead of relying on the partial KV mock.
  async function installInactiveStoreLocalDataBackend() {
    const { installStoreLocalDataBackend } = await import('./storeLocalDataBackendHost');
    installStoreLocalDataBackend({
      mode: 'transactional',
      read: async () => null,
      listKeysWithPrefix: async () => [],
      commitAtomic: async () => {}
    });
  }

  it('returns a persistence repair signal instead of writing normalized payloads during hydrate', async () => {
    const kvGet = vi.fn(async (key: string) => {
      if (key !== 'runtime-providers-v2') return null;
      return {
        providers: [],
        activeProviderId: null
      };
    });
    const kvSet = vi.fn(async () => {});
    vi.doMock('../infrastructure/persistence', () => ({ kvGet, kvSet }));
    await installInactiveStoreLocalDataBackend();

    const { hydrateFromDb } = await import('./runtimeStorePersistence');
    const result = await hydrateFromDb();

    expect(result?.shouldPersist).toBe(true);
    expect(result?.payload.providers.length).toBeGreaterThan(0);
    expect(kvGet).toHaveBeenCalledWith('runtime-providers-v2');
    expect(kvGet).not.toHaveBeenCalledWith('runtime-api-v1');
    expect(kvSet).not.toHaveBeenCalled();
  });

  it('drops stale invite Mimo providers so runtime falls back to the user provider placeholder', async () => {
    const kvGet = vi.fn(async (key: string) => {
      if (key !== 'runtime-providers-v2') return null;
      return {
        providers: [{
          id: 'legacy-mimo',
          name: '✨ Mimo 内测',
          protocol: 'openai-completions',
          baseUrl: '/api/mimo',
          path: '/chat/completions',
          apiKey: 'polaris-mimo-invite',
          model: 'mimo-v2-pro',
          capabilities: {
            images: false,
            streaming: true,
            thinking: false
          }
        }],
        activeProviderId: 'legacy-mimo'
      };
    });
    const kvSet = vi.fn(async () => {});
    vi.doMock('../infrastructure/persistence', () => ({ kvGet, kvSet }));
    await installInactiveStoreLocalDataBackend();

    const { hydrateFromDb } = await import('./runtimeStorePersistence');
    const result = await hydrateFromDb();

    expect(result?.shouldPersist).toBe(true);
    expect(result?.payload.activeProviderId).toBe('provider-custom-default');
    expect(result?.payload.providers.some((provider) => provider.id === 'legacy-mimo')).toBe(false);
    expect(result?.payload.providers[0]).toMatchObject({
      id: 'provider-custom-default',
      baseUrl: '',
      path: '/chat/completions'
    });
  });

  it('throws in strict read mode when runtime storage fails', async () => {
    const readError = new Error('db unavailable');
    const kvGet = vi.fn(async () => {
      throw readError;
    });
    const kvSet = vi.fn(async () => {});
    vi.doMock('../infrastructure/persistence', () => ({ kvGet, kvSet }));
    await installInactiveStoreLocalDataBackend();

    const { hydrateFromDb } = await import('./runtimeStorePersistence');

    await expect(hydrateFromDb({ throwOnReadFailure: true })).rejects.toBe(readError);
  });
});
