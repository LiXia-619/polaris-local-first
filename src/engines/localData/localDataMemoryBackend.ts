import type { PersistedDbEntry } from '../../infrastructure/persistence';
import type {
  LocalDataBackendMutation,
  LocalDataCommitMeta,
  LocalDataTransactionalBackend
} from './types';

export type LocalDataMemoryBackend = LocalDataTransactionalBackend & {
  entries(): PersistedDbEntry[];
  committed(): Array<{
    meta: LocalDataCommitMeta;
    mutations: LocalDataBackendMutation[];
  }>;
};

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createLocalDataMemoryBackend(initialEntries: PersistedDbEntry[] = []): LocalDataMemoryBackend {
  const rows = new Map(initialEntries.map((entry) => [entry.key, cloneValue(entry.value)]));
  const commits: Array<{
    meta: LocalDataCommitMeta;
    mutations: LocalDataBackendMutation[];
  }> = [];

  return {
    mode: 'transactional',

    async read<T>(key: string) {
      return rows.has(key) ? cloneValue(rows.get(key) as T) : null;
    },

    async listKeysWithPrefix(prefix: string) {
      return Array.from(rows.keys()).filter((key) => key.startsWith(prefix));
    },

    async commitAtomic(mutations, meta) {
      commits.push({
        meta: cloneValue(meta),
        mutations: cloneValue(mutations)
      });
      mutations.forEach((mutation) => {
        if (mutation.type === 'set') {
          rows.set(mutation.key, cloneValue(mutation.value));
          return;
        }
        rows.delete(mutation.key);
      });
    },

    entries() {
      return Array.from(rows.entries()).map(([key, value]) => ({
        key,
        value: cloneValue(value)
      }));
    },

    committed() {
      return cloneValue(commits);
    }
  };
}
