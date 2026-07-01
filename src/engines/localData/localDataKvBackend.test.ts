import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KV_STORE,
  kvGet,
  kvSet,
  setPersistenceBackendForTesting,
  type PersistedDbEntry,
  type PersistedKvMutation,
  type PersistenceBackend
} from '../../infrastructure/persistence';
import {
  createCompleteLocalDataRow,
  createLocalDataRepository,
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  UntrustedPersistenceError,
  type LocalDataBackend,
  type LocalDataCommitMeta,
  type LocalDataRef
} from './index';
import { createLocalDataKvBackend } from './localDataKvBackend';

const conversationRef: LocalDataRef = {
  domain: 'chat',
  kind: 'conversationRecord',
  id: 'c-native'
};

function createPersistenceBackend(args: {
  localDataCommitMode?: PersistenceBackend['localDataCommitMode'];
  kv?: PersistedDbEntry[];
  onBeforeGet?: (key: string) => void;
  onAfterApplyMutations?: () => void;
  onBeforeReplaceAll?: () => void;
  corruptApplyMutations?: (mutations: PersistedKvMutation[]) => PersistedKvMutation[];
  corruptReplaceAll?: (entries: PersistedDbEntry[]) => PersistedDbEntry[];
} = {}): PersistenceBackend & {
  kvApplyMutationsSpy: ReturnType<typeof vi.fn>;
  kvReplaceAllSpy: ReturnType<typeof vi.fn>;
} {
  const stores = new Map<string, Map<string, unknown>>([
    [KV_STORE, new Map((args.kv ?? []).map((entry) => [entry.key, entry.value]))]
  ]);
  const kvApplyMutationsSpy = vi.fn();
  const kvReplaceAllSpy = vi.fn();
  const getStore = (storeName: string) => {
    let store = stores.get(storeName);
    if (!store) {
      store = new Map();
      stores.set(storeName, store);
    }
    return store;
  };

  return {
    localDataCommitMode: args.localDataCommitMode,
    kvApplyMutationsSpy,
    kvReplaceAllSpy,
    async dbStoreGet<T>(storeName: string, key: string) {
      args.onBeforeGet?.(key);
      await Promise.resolve();
      return (getStore(storeName).get(key) as T | undefined) ?? null;
    },
    async dbStoreSet(storeName: string, key: string, value: unknown) {
      getStore(storeName).set(key, value);
    },
    async dbStoreDelete(storeName: string, key: string) {
      getStore(storeName).delete(key);
    },
    async dbStoreEntries<T>(storeName: string) {
      return Array.from(getStore(storeName).entries()).map(([key, value]) => ({
        key,
        value: value as T
      }));
    },
    async dbStoreClear(storeName: string) {
      getStore(storeName).clear();
    },
    async kvApplyMutations(mutations: PersistedKvMutation[]) {
      kvApplyMutationsSpy(mutations);
      const appliedMutations = args.corruptApplyMutations ? args.corruptApplyMutations(mutations) : mutations;
      const kvStore = getStore(KV_STORE);
      for (const mutation of appliedMutations) {
        if (mutation.type === 'set') {
          kvStore.set(mutation.key, mutation.value);
        } else {
          kvStore.delete(mutation.key);
        }
      }
      args.onAfterApplyMutations?.();
    },
    async kvReplaceAll(entries: PersistedDbEntry[]) {
      kvReplaceAllSpy(entries);
      args.onBeforeReplaceAll?.();
      const replacementEntries = args.corruptReplaceAll ? args.corruptReplaceAll(entries) : entries;
      stores.set(KV_STORE, new Map(replacementEntries.map((entry) => [entry.key, entry.value])));
    }
  };
}

function createRepository(backend: LocalDataBackend) {
  return createLocalDataRepository({
    backend,
    now: () => 100,
    createCommitId: () => 'native-localdata-commit'
  });
}

describe('createLocalDataKvBackend', () => {
  afterEach(() => {
    setPersistenceBackendForTesting(null);
  });

  it('uses transactional commits when the persistence backend can apply KV mutations atomically', async () => {
    const persistenceBackend = createPersistenceBackend({
      localDataCommitMode: 'transactional'
    });
    setPersistenceBackendForTesting(persistenceBackend);
    const backend = createLocalDataKvBackend();
    const repository = createRepository(backend);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['indexeddb'] },
      version: 3,
      updatedAt: 100
    });

    await repository.commit({
      domain: 'chat',
      version: 3,
      mutations: [{ type: 'put', row }]
    });

    expect(backend.mode).toBe('transactional');
    expect(persistenceBackend.kvApplyMutationsSpy).toHaveBeenCalledOnce();
    expect(persistenceBackend.kvReplaceAllSpy).not.toHaveBeenCalled();
  });

  it('uses targeted mutation readback commits for native LocalData writes by default', async () => {
    const persistenceBackend = createPersistenceBackend({
      localDataCommitMode: 'staged'
    });
    setPersistenceBackendForTesting(persistenceBackend);
    const backend = createLocalDataKvBackend();
    const repository = createRepository(backend);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['native'] },
      version: 3,
      updatedAt: 100
    });

    const meta = await repository.commit({
      domain: 'chat',
      version: 3,
      mutations: [{ type: 'put', row }]
    });

    expect(backend.mode).toBe('transactional');
    expect(persistenceBackend.kvApplyMutationsSpy).toHaveBeenCalledOnce();
    expect(persistenceBackend.kvReplaceAllSpy).not.toHaveBeenCalled();
    await expect(backend.read(getLocalDataRowKey(conversationRef))).resolves.toEqual(row);
    await expect(backend.read(getLocalDataCommitPointerKey('chat'))).resolves.toEqual(meta);
    await expect(backend.read(getLocalDataActiveDataSourceKey())).resolves.toBeNull();
  });

  it('rejects targeted mutation commits when readback does not match the mutation keys', async () => {
    const pointerKey = getLocalDataCommitPointerKey('chat');
    const persistenceBackend = createPersistenceBackend({
      localDataCommitMode: 'staged',
      corruptApplyMutations: (mutations) => mutations.filter((mutation) => mutation.key !== pointerKey)
    });
    setPersistenceBackendForTesting(persistenceBackend);
    const backend = createLocalDataKvBackend();
    const repository = createRepository(backend);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['native-readback'] },
      version: 3,
      updatedAt: 100
    });

    await expect(repository.commit({
      domain: 'chat',
      version: 3,
      mutations: [{ type: 'put', row }]
    })).rejects.toBeInstanceOf(UntrustedPersistenceError);

    expect(backend.mode).toBe('transactional');
    expect(persistenceBackend.kvApplyMutationsSpy).toHaveBeenCalledOnce();
    expect(persistenceBackend.kvReplaceAllSpy).not.toHaveBeenCalled();
    await expect(backend.read<LocalDataCommitMeta>(pointerKey)).resolves.toBeNull();
  });

  it('compares targeted mutation readback against the JSON-persisted value shape', async () => {
    const persistenceBackend = createPersistenceBackend({
      localDataCommitMode: 'staged'
    });
    setPersistenceBackendForTesting(persistenceBackend);
    const backend = createLocalDataKvBackend();
    const repository = createRepository(backend);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: {
        title: 'native-mutation-json',
        optionalUndefined: undefined,
        nested: {
          preserved: true,
          dropped: undefined
        }
      },
      version: 3,
      updatedAt: 100
    });
    const jsonPersistedRow = JSON.parse(JSON.stringify(row));

    await expect(repository.commit({
      domain: 'chat',
      version: 3,
      mutations: [{ type: 'put', row }]
    })).resolves.toEqual(expect.objectContaining({
      commitId: 'native-localdata-commit'
    }));

    expect(persistenceBackend.kvApplyMutationsSpy).toHaveBeenCalledOnce();
    expect(persistenceBackend.kvApplyMutationsSpy.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([{
      key: getLocalDataRowKey(conversationRef),
      type: 'set',
      value: jsonPersistedRow
    }]));
    expect(persistenceBackend.kvReplaceAllSpy).not.toHaveBeenCalled();
    await expect(backend.read(getLocalDataRowKey(conversationRef))).resolves.toEqual(jsonPersistedRow);
  });

  it('holds the persistence-wide KV write gate across targeted mutation readback', async () => {
    let overwriteWrite: Promise<void> | null = null;
    const rowKey = getLocalDataRowKey(conversationRef);
    const committedRow = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['native-readback-committed'] },
      version: 3,
      updatedAt: 100
    });
    const laterRow = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['queued-overwrite'] },
      version: 3,
      updatedAt: 101
    });
    let mutationsApplied = false;
    const persistenceBackend = createPersistenceBackend({
      localDataCommitMode: 'staged',
      onAfterApplyMutations: () => {
        mutationsApplied = true;
      },
      onBeforeGet: (key) => {
        if (!mutationsApplied || key !== rowKey || overwriteWrite) return;
        overwriteWrite = kvSet(rowKey, laterRow);
      }
    });
    setPersistenceBackendForTesting(persistenceBackend);
    const backend = createLocalDataKvBackend();
    const repository = createRepository(backend);

    await expect(repository.commit({
      domain: 'chat',
      version: 3,
      mutations: [{ type: 'put', row: committedRow }]
    })).resolves.toEqual(expect.objectContaining({
      commitId: 'native-localdata-commit'
    }));
    await overwriteWrite;

    expect(persistenceBackend.kvApplyMutationsSpy).toHaveBeenCalledOnce();
    await expect(backend.read(rowKey)).resolves.toEqual(laterRow);
  });

  it('compares forced staged mutation readback against the JSON-persisted value shape', async () => {
    const persistenceBackend = createPersistenceBackend({
      localDataCommitMode: 'staged'
    });
    setPersistenceBackendForTesting(persistenceBackend);
    const backend = createLocalDataKvBackend({ commitMode: 'staged' });
    const repository = createRepository(backend);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: {
        title: 'native-json',
        optionalUndefined: undefined,
        nested: {
          preserved: true,
          dropped: undefined
        }
      },
      version: 3,
      updatedAt: 100
    });
    const jsonPersistedRow = JSON.parse(JSON.stringify(row));

    await expect(repository.commit({
      domain: 'chat',
      version: 3,
      mutations: [{ type: 'put', row }]
    })).resolves.toEqual(expect.objectContaining({
      commitId: 'native-localdata-commit'
    }));

    expect(persistenceBackend.kvApplyMutationsSpy).toHaveBeenCalledOnce();
    expect(persistenceBackend.kvApplyMutationsSpy.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([{
      key: getLocalDataRowKey(conversationRef),
      type: 'set',
      value: jsonPersistedRow
    }]));
    expect(persistenceBackend.kvReplaceAllSpy).not.toHaveBeenCalled();
    await expect(backend.read(getLocalDataRowKey(conversationRef))).resolves.toEqual(jsonPersistedRow);
  });

  it('holds the persistence-wide KV write gate across forced staged mutation readback', async () => {
    let unrelatedWrite: Promise<void> | null = null;
    let mutationsApplied = false;
    const rowKey = getLocalDataRowKey(conversationRef);
    const persistenceBackend = createPersistenceBackend({
      localDataCommitMode: 'staged',
      onAfterApplyMutations: () => {
        mutationsApplied = true;
      },
      onBeforeGet: (key) => {
        if (!mutationsApplied || key !== rowKey || unrelatedWrite) return;
        unrelatedWrite ??= kvSet('ordinary:queued-before-publish', { value: 'preserved' });
      }
    });
    setPersistenceBackendForTesting(persistenceBackend);
    const backend = createLocalDataKvBackend({ commitMode: 'staged' });
    const repository = createRepository(backend);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['native'] },
      version: 3,
      updatedAt: 100
    });

    await expect(repository.commit({
      domain: 'chat',
      version: 3,
      mutations: [{ type: 'put', row }]
    })).resolves.toEqual(expect.objectContaining({
      commitId: 'native-localdata-commit'
    }));
    await unrelatedWrite;

    expect(persistenceBackend.kvApplyMutationsSpy).toHaveBeenCalledOnce();
    expect(persistenceBackend.kvReplaceAllSpy).not.toHaveBeenCalled();
    await expect(kvGet('ordinary:queued-before-publish')).resolves.toEqual({ value: 'preserved' });
    await expect(backend.read(getLocalDataRowKey(conversationRef))).resolves.toEqual(row);
  });

  it('rejects staged commits when publish readback does not match the mutation keys', async () => {
    const pointerKey = getLocalDataCommitPointerKey('chat');
    const persistenceBackend = createPersistenceBackend({
      localDataCommitMode: 'staged',
      corruptApplyMutations: (mutations) => mutations.filter((mutation) => mutation.key !== pointerKey)
    });
    setPersistenceBackendForTesting(persistenceBackend);
    const backend = createLocalDataKvBackend({ commitMode: 'staged' });
    const repository = createRepository(backend);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['half-written'] },
      version: 3,
      updatedAt: 100
    });

    await expect(repository.commit({
      domain: 'chat',
      version: 3,
      mutations: [{ type: 'put', row }]
    })).rejects.toBeInstanceOf(UntrustedPersistenceError);

    expect(persistenceBackend.kvApplyMutationsSpy).toHaveBeenCalledOnce();
    expect(persistenceBackend.kvReplaceAllSpy).not.toHaveBeenCalled();
    await expect(backend.read<LocalDataCommitMeta>(pointerKey)).resolves.toBeNull();
  });

  it('does not read or rewrite unrelated KV entries during forced staged commits', async () => {
    const unrelatedKey = 'ordinary:existing';
    const persistenceBackend = createPersistenceBackend({
      localDataCommitMode: 'staged',
      kv: [{
        key: unrelatedKey,
        value: { value: 'must-stay' }
      }]
    });
    setPersistenceBackendForTesting(persistenceBackend);
    const backend = createLocalDataKvBackend({ commitMode: 'staged' });
    const repository = createRepository(backend);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['localdata-ok-unrelated-lost'] },
      version: 3,
      updatedAt: 100
    });

    await expect(repository.commit({
      domain: 'chat',
      version: 3,
      mutations: [{ type: 'put', row }]
    })).resolves.toEqual(expect.objectContaining({
      commitId: 'native-localdata-commit'
    }));

    expect(persistenceBackend.kvApplyMutationsSpy).toHaveBeenCalledOnce();
    expect(persistenceBackend.kvApplyMutationsSpy.mock.calls[0]?.[0]).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: unrelatedKey })
    ]));
    expect(persistenceBackend.kvReplaceAllSpy).not.toHaveBeenCalled();
    await expect(kvGet(unrelatedKey)).resolves.toEqual({ value: 'must-stay' });
    await expect(backend.read(getLocalDataActiveDataSourceKey())).resolves.toBeNull();
  });
});
