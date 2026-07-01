import type {
  LocalDataBackendMutation,
  LocalDataCommitMeta,
  LocalDataTransactionalBackend
} from './types';

export const LOCAL_DATA_SQLITE_ENTRIES_TABLE = 'local_data_entries';

export type LocalDataSqliteQueryRow = Record<string, unknown>;

export type LocalDataSqliteDriver = {
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
  query<T extends LocalDataSqliteQueryRow = LocalDataSqliteQueryRow>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<T[]>;
};

export type LocalDataSqliteBackendOptions = {
  driver: LocalDataSqliteDriver;
};

type SerializedLocalDataMutation =
  | { type: 'set'; key: string; valueJson: string }
  | { type: 'delete'; key: string };

const CREATE_ENTRIES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${LOCAL_DATA_SQLITE_ENTRIES_TABLE} (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`;

const READ_ENTRY_SQL = `
SELECT value_json
FROM ${LOCAL_DATA_SQLITE_ENTRIES_TABLE}
WHERE key = ?
LIMIT 1`;

const LIST_KEYS_WITH_PREFIX_SQL = `
SELECT key
FROM ${LOCAL_DATA_SQLITE_ENTRIES_TABLE}
WHERE substr(key, 1, ?) = ?`;

const UPSERT_ENTRY_SQL = `
INSERT INTO ${LOCAL_DATA_SQLITE_ENTRIES_TABLE} (key, value_json, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET
  value_json = excluded.value_json,
  updated_at = excluded.updated_at`;

const DELETE_ENTRY_SQL = `
DELETE FROM ${LOCAL_DATA_SQLITE_ENTRIES_TABLE}
WHERE key = ?`;

function normalizeSql(sql: string) {
  return sql.trim().replace(/\s+/g, ' ');
}

function getValueJson(row: LocalDataSqliteQueryRow, key: string) {
  const valueJson = row.value_json ?? row.valueJson;
  if (typeof valueJson !== 'string') {
    throw new Error(`LocalData SQLite row is missing value_json for ${key}`);
  }
  return valueJson;
}

function getKey(row: LocalDataSqliteQueryRow) {
  const key = row.key;
  if (typeof key !== 'string') {
    throw new Error('LocalData SQLite row is missing key');
  }
  return key;
}

function serializeValue(value: unknown, key: string) {
  try {
    const valueJson = JSON.stringify(value);
    if (valueJson === undefined) {
      throw new Error('value is not JSON-persistable');
    }
    return valueJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`LocalData SQLite value is not JSON-persistable for ${key}: ${message}`);
  }
}

function deserializeValue<T>(valueJson: string, key: string): T {
  try {
    return JSON.parse(valueJson) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`LocalData SQLite value JSON is invalid for ${key}: ${message}`);
  }
}

function serializeMutations(mutations: LocalDataBackendMutation[]): SerializedLocalDataMutation[] {
  return mutations.map((mutation) => {
    if (mutation.type === 'delete') {
      return {
        type: 'delete',
        key: mutation.key
      };
    }

    return {
      type: 'set',
      key: mutation.key,
      valueJson: serializeValue(mutation.value, mutation.key)
    };
  });
}

export function createLocalDataSqliteBackend(
  options: LocalDataSqliteBackendOptions
): LocalDataTransactionalBackend {
  let schemaReady: Promise<void> | null = null;
  let transactionTail: Promise<void> = Promise.resolve();

  const ensureSchema = () => {
    schemaReady ??= options.driver.execute(CREATE_ENTRIES_TABLE_SQL);
    return schemaReady;
  };

  const runExclusiveTransaction = async (transaction: () => Promise<void>) => {
    const previousTail = transactionTail;
    let releaseTail: () => void;
    transactionTail = new Promise<void>((resolve) => {
      releaseTail = resolve;
    });

    await previousTail;
    try {
      await transaction();
    } finally {
      releaseTail!();
    }
  };

  return {
    mode: 'transactional',

    async read<T>(key: string) {
      await ensureSchema();
      const rows = await options.driver.query(READ_ENTRY_SQL, [key]);
      const row = rows[0];
      if (!row) return null;
      return deserializeValue<T>(getValueJson(row, key), key);
    },

    async listKeysWithPrefix(prefix: string) {
      await ensureSchema();
      const rows = await options.driver.query(LIST_KEYS_WITH_PREFIX_SQL, [prefix.length, prefix]);
      return rows.map((row) => getKey(row));
    },

    async commitAtomic(mutations: LocalDataBackendMutation[], meta: LocalDataCommitMeta) {
      const serializedMutations = serializeMutations(mutations);

      await ensureSchema();
      await runExclusiveTransaction(async () => {
        await options.driver.execute('BEGIN IMMEDIATE');
        try {
          for (const mutation of serializedMutations) {
            if (mutation.type === 'delete') {
              await options.driver.execute(DELETE_ENTRY_SQL, [mutation.key]);
              continue;
            }

            await options.driver.execute(UPSERT_ENTRY_SQL, [
              mutation.key,
              mutation.valueJson,
              meta.committedAt
            ]);
          }
          await options.driver.execute('COMMIT');
        } catch (error) {
          try {
            await options.driver.execute('ROLLBACK');
          } catch {
            // The original write failure is the durable-state signal the caller needs.
          }
          throw error;
        }
      });
    }
  };
}

export const localDataSqliteSql = {
  createEntriesTable: normalizeSql(CREATE_ENTRIES_TABLE_SQL),
  readEntry: normalizeSql(READ_ENTRY_SQL),
  listKeysWithPrefix: normalizeSql(LIST_KEYS_WITH_PREFIX_SQL),
  upsertEntry: normalizeSql(UPSERT_ENTRY_SQL),
  deleteEntry: normalizeSql(DELETE_ENTRY_SQL)
};
