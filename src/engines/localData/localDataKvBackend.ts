import {
  acquireExclusiveKvWriteGate,
  getPersistenceLocalDataCommitMode,
  kvApplyMutations,
  kvGet,
  kvKeysWithPrefix,
  withExclusiveKvWriteGate,
  type PersistenceKvWriteGateLease,
  type PersistedKvMutation
} from '../../infrastructure/persistence';
import type {
  LocalDataBackend,
  LocalDataBackendMutation,
  LocalDataCommitMeta,
  LocalDataStagedBackend,
  LocalDataTransactionalBackend
} from './types';

type LocalDataKvStage = {
  meta: LocalDataCommitMeta;
  mutations: LocalDataBackendMutation[];
  persistedMutations: PersistedKvMutation[];
  lease: PersistenceKvWriteGateLease;
};

export type LocalDataKvBackendOptions = {
  commitMode?: 'default' | 'staged';
};

export function createLocalDataKvBackend(options: LocalDataKvBackendOptions = {}): LocalDataBackend {
  if (options.commitMode === 'staged') {
    return createStagedLocalDataKvBackend();
  }

  return getPersistenceLocalDataCommitMode() === 'staged'
    ? createMutationReadbackLocalDataKvBackend()
    : createTransactionalLocalDataKvBackend();
}

async function listLocalDataKvKeysWithPrefix(prefix: string) {
  return await kvKeysWithPrefix(prefix);
}

function createMutationReadbackLocalDataKvBackend(): LocalDataTransactionalBackend {
  return {
    mode: 'transactional',
    async read<T>(key: string) {
      return await kvGet<T>(key);
    },
    listKeysWithPrefix: listLocalDataKvKeysWithPrefix,
    async commitAtomic(mutations) {
      const persistedMutations = toJsonPersistenceMutations(mutations);
      await withExclusiveKvWriteGate(async (gateToken) => {
        await kvApplyMutations(persistedMutations, { gateToken });
        await assertAppliedMutations(persistedMutations);
      });
    }
  };
}

export function createStagedLocalDataKvBackendForMigration(): LocalDataBackend {
  return createLocalDataKvBackend({ commitMode: 'staged' });
}

function createTransactionalLocalDataKvBackend(): LocalDataTransactionalBackend {
  return {
    mode: 'transactional',
    async read<T>(key: string) {
      return await kvGet<T>(key);
    },
    listKeysWithPrefix: listLocalDataKvKeysWithPrefix,
    async commitAtomic(mutations) {
      await kvApplyMutations(mutations);
    }
  };
}

function createStagedLocalDataKvBackend(): LocalDataStagedBackend {
  const stages = new Map<string, LocalDataKvStage>();

  return {
    mode: 'staged',
    async read<T>(key: string) {
      return await kvGet<T>(key);
    },
    listKeysWithPrefix: listLocalDataKvKeysWithPrefix,
    async stageCommit(stageId, mutations, meta) {
      const lease = await acquireExclusiveKvWriteGate();
      try {
        stages.set(stageId, {
          meta,
          mutations: cloneMutations(mutations),
          persistedMutations: toJsonPersistenceMutations(mutations),
          lease
        });
      } catch (error) {
        lease.release();
        throw error;
      }
    },
    async verifyCommit(stageId, mutations, meta) {
      const stage = stages.get(stageId);
      if (!stage) return false;
      return commitMetaMatches(stage.meta, meta)
        && mutationsMatch(stage.mutations, mutations);
    },
    async publishCommit(stageId, mutations, meta) {
      const stage = stages.get(stageId);
      if (!stage || !commitMetaMatches(stage.meta, meta) || !mutationsMatch(stage.mutations, mutations)) {
        throw new Error(`LocalData staged KV commit is not verified: ${stageId}`);
      }

      await kvApplyMutations(stage.persistedMutations, { gateToken: stage.lease.token });
      await assertAppliedMutations(stage.persistedMutations);
    },
    async clearStage(stageId) {
      const stage = stages.get(stageId);
      stages.delete(stageId);
      stage?.lease.release();
    }
  };
}

async function assertAppliedMutations(mutations: PersistedKvMutation[]) {
  const expectedByKey = new Map(mutations.map((mutation) => [mutation.key, mutation]));

  for (const [key, expectedMutation] of expectedByKey) {
    const actualValue = await kvGet(key);
    if (expectedMutation.type === 'delete') {
      if (actualValue !== null) {
        throw new Error(`LocalData mutation KV commit failed delete readback for ${key}`);
      }
      continue;
    }

    if (!valuesMatch(actualValue, expectedMutation.value)) {
      throw new Error(`LocalData mutation KV commit failed readback for ${key}`);
    }
  }
}

function toJsonPersistenceMutations(mutations: LocalDataBackendMutation[]): PersistedKvMutation[] {
  return mutations.map((mutation) => {
    if (mutation.type === 'delete') return mutation;
    return {
      type: 'set',
      key: mutation.key,
      value: toJsonPersistenceValue(mutation.value)
    };
  });
}

function cloneMutations(mutations: LocalDataBackendMutation[]) {
  return mutations.map((mutation) => ({ ...mutation }));
}

function commitMetaMatches(left: LocalDataCommitMeta, right: LocalDataCommitMeta) {
  return left.commitId === right.commitId
    && left.domain === right.domain
    && left.version === right.version
    && left.committedAt === right.committedAt;
}

function mutationsMatch(left: LocalDataBackendMutation[], right: LocalDataBackendMutation[]) {
  if (left.length !== right.length) return false;
  return left.every((mutation, index) => {
    const other = right[index];
    if (!other || mutation.type !== other.type || mutation.key !== other.key) return false;
    if (mutation.type === 'delete' || other.type === 'delete') return true;
    return valuesMatch(mutation.value, other.value);
  });
}

function valuesMatch(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => valuesMatch(item, right[index]));
  }
  if (isPlainRecord(left) || isPlainRecord(right)) {
    if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (!valuesMatch(leftKeys, rightKeys)) return false;
    return leftKeys.every((key) => valuesMatch(left[key], right[key]));
  }
  return false;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toJsonPersistenceValue(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error('LocalData staged KV value is not JSON-persistable');
  }
  return JSON.parse(serialized) as unknown;
}
