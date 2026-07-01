import {
  createLocalDataKvBackend,
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataBackend,
  type LocalDataBackendMutation,
  type LocalDataCommitMeta,
  type LocalDataDomain
} from '../engines/localData';

/**
 * The single place the ordinary store layer obtains its LocalData backend.
 *
 * Ordinary store/domain persistence must NEVER construct a backend itself (no direct
 * `createLocalDataKvBackend`, no SQLite backend, no `if (sqliteAvailable) … else …` fork).
 * It asks the host, and the host decides which backend is active. That keeps storage choice
 * a single structural decision instead of a branch scattered across every persist path.
 *
 * Until a native SQLite backend is installed into the startup path, the host falls back to
 * the KV backend, so installing nothing keeps today's behavior exactly — this is the
 * structural seam SQLite slots into later, not the SQLite switch itself.
 */
let installedBackend: LocalDataBackend | null = null;

export function installStoreLocalDataBackend(backend: LocalDataBackend) {
  installedBackend = backend;
}

export function resetStoreLocalDataBackendForTesting() {
  installedBackend = null;
}

export function isStoreLocalDataBackendInstalled() {
  return installedBackend !== null;
}

export function getStoreLocalDataBackend(): LocalDataBackend {
  return installedBackend ?? createLocalDataKvBackend();
}

/**
 * Thin read accessors so ordinary store code reads CURRENT LocalData repository facts
 * (`local-data-v1:` rows, the active-data-source pointer, domain meta) through the active
 * backend instead of a raw KV API. This is what keeps the fact source single once SQLite is
 * the installed backend: there is no `kvGet`/`kvKeysWithPrefix` path that bypasses it.
 */
export async function readStoreLocalDataValue<T>(key: string): Promise<T | null> {
  return await getStoreLocalDataBackend().read<T>(key);
}

export async function listStoreLocalDataKeysWithPrefix(prefix: string): Promise<string[]> {
  return await getStoreLocalDataBackend().listKeysWithPrefix(prefix);
}

export async function readStoreLocalDataEntriesWithPrefix<T = unknown>(
  prefix: string
): Promise<Array<{ key: string; value: T }>> {
  const backend = getStoreLocalDataBackend();
  const keys = await backend.listKeysWithPrefix(prefix);
  const entries: Array<{ key: string; value: T }> = [];
  for (const key of keys) {
    const value = await backend.read<T>(key);
    if (value !== null) {
      entries.push({ key, value });
    }
  }
  return entries;
}

export async function clearStoreLocalDataEntriesWithPrefix(
  prefix: string,
  options: {
    commitId: string;
    committedAt?: number;
    domain?: LocalDataDomain;
  }
) {
  const backend = getStoreLocalDataBackend();
  const keys = await backend.listKeysWithPrefix(prefix);
  if (keys.length === 0) {
    return { deletedKeyCount: 0 };
  }

  const committedAt = options.committedAt ?? Date.now();
  const meta: LocalDataCommitMeta = {
    commitId: options.commitId,
    domain: options.domain ?? 'runtime',
    version: LOCAL_DATA_SCHEMA_VERSION,
    committedAt
  };
  const mutations: LocalDataBackendMutation[] = keys.map((key) => ({ type: 'delete', key }));

  if (backend.mode === 'transactional') {
    await backend.commitAtomic(mutations, meta);
    return { deletedKeyCount: keys.length };
  }

  const stageId = `${meta.commitId}:stage`;
  await backend.stageCommit(stageId, mutations, meta);
  try {
    const verified = await backend.verifyCommit(stageId, mutations, meta);
    if (!verified) {
      throw new Error(`LocalData clear failed staged verification: ${meta.commitId}`);
    }
    await backend.publishCommit(stageId, mutations, meta);
  } finally {
    await backend.clearStage?.(stageId);
  }
  return { deletedKeyCount: keys.length };
}
