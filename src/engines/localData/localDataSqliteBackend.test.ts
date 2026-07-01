import { describe, expect, it } from 'vitest';
import {
  createCompleteLocalDataRow,
  createLocalDataRepository,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  type LocalDataBackendMutation,
  type LocalDataRef
} from './index';
import {
  createLocalDataSqliteBackend,
  localDataSqliteSql,
  type LocalDataSqliteDriver,
  type LocalDataSqliteQueryRow
} from './localDataSqliteBackend';

const conversationRef: LocalDataRef = {
  domain: 'chat',
  kind: 'conversationRecord',
  id: 'sqlite-c-1'
};

type SqliteStatement = {
  kind: 'execute' | 'query';
  sql: string;
  params: readonly unknown[];
};

function normalizeSql(sql: string) {
  return sql.trim().replace(/\s+/g, ' ');
}

function createSqliteDriver(args: {
  initialRows?: Array<{ key: string; valueJson: string; updatedAt: number }>;
  failOnKey?: string;
} = {}): LocalDataSqliteDriver & {
  rows: Map<string, { valueJson: string; updatedAt: number }>;
  statements: SqliteStatement[];
} {
  const rows = new Map<string, { valueJson: string; updatedAt: number }>(
    (args.initialRows ?? []).map((row) => [row.key, {
      valueJson: row.valueJson,
      updatedAt: row.updatedAt
    }])
  );
  const statements: SqliteStatement[] = [];
  let transactionRows: Map<string, { valueJson: string; updatedAt: number }> | null = null;

  const activeRows = () => transactionRows ?? rows;

  return {
    rows,
    statements,

    async execute(sql: string, params: readonly unknown[] = []) {
      const normalizedSql = normalizeSql(sql);
      statements.push({ kind: 'execute', sql: normalizedSql, params });

      if (normalizedSql === localDataSqliteSql.createEntriesTable) return;
      if (normalizedSql === 'BEGIN IMMEDIATE') {
        transactionRows = new Map(rows);
        return;
      }
      if (normalizedSql === 'COMMIT') {
        if (transactionRows) {
          rows.clear();
          for (const [key, value] of transactionRows) rows.set(key, value);
          transactionRows = null;
        }
        return;
      }
      if (normalizedSql === 'ROLLBACK') {
        transactionRows = null;
        return;
      }
      if (normalizedSql === localDataSqliteSql.upsertEntry) {
        const [key, valueJson, updatedAt] = params;
        if (typeof key !== 'string' || typeof valueJson !== 'string' || typeof updatedAt !== 'number') {
          throw new Error('invalid upsert params');
        }
        if (args.failOnKey === key) {
          throw new Error(`simulated sqlite write failure for ${key}`);
        }
        activeRows().set(key, { valueJson, updatedAt });
        return;
      }
      if (normalizedSql === localDataSqliteSql.deleteEntry) {
        const [key] = params;
        if (typeof key !== 'string') throw new Error('invalid delete params');
        activeRows().delete(key);
        return;
      }

      throw new Error(`unexpected execute SQL: ${normalizedSql}`);
    },

    async query<T extends LocalDataSqliteQueryRow = LocalDataSqliteQueryRow>(
      sql: string,
      params: readonly unknown[] = []
    ): Promise<T[]> {
      const normalizedSql = normalizeSql(sql);
      statements.push({ kind: 'query', sql: normalizedSql, params });

      if (normalizedSql !== localDataSqliteSql.readEntry) {
        throw new Error(`unexpected query SQL: ${normalizedSql}`);
      }
      const [key] = params;
      if (typeof key !== 'string') throw new Error('invalid read params');
      const row = activeRows().get(key);
      return row ? [{ value_json: row.valueJson } as unknown as T] : [];
    }
  };
}

function createRepository(driver: LocalDataSqliteDriver) {
  return createLocalDataRepository({
    backend: createLocalDataSqliteBackend({ driver }),
    now: () => 200,
    createCommitId: () => 'sqlite-commit'
  });
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('createLocalDataSqliteBackend', () => {
  it('commits LocalData rows and domain pointers inside one SQLite transaction', async () => {
    const driver = createSqliteDriver();
    const repository = createRepository(driver);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['sqlite'] },
      version: 7,
      updatedAt: 200
    });

    const meta = await repository.commit({
      domain: 'chat',
      version: 7,
      mutations: [{ type: 'put', row }]
    });

    await expect(repository.read(conversationRef)).resolves.toEqual(expect.objectContaining({
      status: 'complete',
      value: { messages: ['sqlite'] }
    }));
    await expect(createLocalDataSqliteBackend({ driver }).read(getLocalDataCommitPointerKey('chat')))
      .resolves.toEqual(meta);
    expect(driver.statements.map((statement) => statement.sql)).toEqual(expect.arrayContaining([
      'BEGIN IMMEDIATE',
      'COMMIT',
      localDataSqliteSql.upsertEntry
    ]));
  });

  it('serializes mutations before opening a transaction', async () => {
    const driver = createSqliteDriver();
    const backend = createLocalDataSqliteBackend({ driver });
    const circularValue: Record<string, unknown> = {};
    circularValue.self = circularValue;
    const mutations: LocalDataBackendMutation[] = [{
      type: 'set',
      key: getLocalDataRowKey(conversationRef),
      value: circularValue
    }];

    await expect(backend.commitAtomic(mutations, {
      domain: 'chat',
      version: 1,
      commitId: 'bad-json',
      committedAt: 1
    })).rejects.toThrow('not JSON-persistable');

    expect(driver.statements.map((statement) => statement.sql)).not.toContain('BEGIN IMMEDIATE');
    expect(driver.rows.size).toBe(0);
  });

  it('rolls back the whole transaction when one mutation fails', async () => {
    const failingKey = getLocalDataCommitPointerKey('chat');
    const driver = createSqliteDriver({ failOnKey: failingKey });
    const repository = createRepository(driver);
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['rolled back'] },
      version: 7,
      updatedAt: 200
    });

    await expect(repository.commit({
      domain: 'chat',
      version: 7,
      mutations: [{ type: 'put', row }]
    })).rejects.toMatchObject({
      name: 'UntrustedPersistenceError',
      reason: 'backend-error'
    });

    expect(driver.statements.map((statement) => statement.sql)).toEqual(expect.arrayContaining([
      'BEGIN IMMEDIATE',
      'ROLLBACK'
    ]));
    expect(driver.rows.has(row.key)).toBe(false);
    expect(driver.rows.has(failingKey)).toBe(false);
  });

  it('does not turn invalid stored JSON into an empty result', async () => {
    const rowKey = getLocalDataRowKey(conversationRef);
    const backend = createLocalDataSqliteBackend({
      driver: createSqliteDriver({
        initialRows: [{
          key: rowKey,
          valueJson: '{bad-json',
          updatedAt: 1
        }]
      })
    });

    await expect(backend.read(rowKey)).rejects.toThrow('value JSON is invalid');
  });

  it('supports explicit delete mutations for future repository contracts', async () => {
    const rowKey = getLocalDataRowKey(conversationRef);
    const driver = createSqliteDriver({
      initialRows: [{
        key: rowKey,
        valueJson: JSON.stringify({ persisted: true }),
        updatedAt: 1
      }]
    });
    const backend = createLocalDataSqliteBackend({ driver });

    await backend.commitAtomic([{
      type: 'delete',
      key: rowKey
    }], {
      domain: 'chat',
      version: 2,
      commitId: 'delete-row',
      committedAt: 2
    });

    await expect(backend.read(rowKey)).resolves.toBeNull();
  });

  it('does not rerun schema setup after the first successful operation', async () => {
    const driver = createSqliteDriver();
    const backend = createLocalDataSqliteBackend({ driver });

    await backend.read('missing-1');
    await backend.read('missing-2');

    expect(driver.statements.filter((statement) => (
      statement.kind === 'execute'
      && statement.sql === localDataSqliteSql.createEntriesTable
    ))).toHaveLength(1);
  });

  it('keeps concurrent commits from interleaving inside SQL transactions', async () => {
    const rowA = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['a'] },
      version: 1,
      updatedAt: 1
    });
    const rowB = createCompleteLocalDataRow({
      ref: { ...conversationRef, id: 'sqlite-c-2' },
      value: { messages: ['b'] },
      version: 1,
      updatedAt: 1
    });
    const firstCommitPaused = createDeferred();
    const releaseFirstCommit = createDeferred();
    let firstUpsertPaused = false;
    const driver = createSqliteDriver();
    const originalExecute = driver.execute;
    driver.execute = async (sql, params) => {
      const key = params?.[0];
      if (
        normalizeSql(sql) === localDataSqliteSql.upsertEntry
        && key === rowA.key
        && !firstUpsertPaused
      ) {
        firstUpsertPaused = true;
        firstCommitPaused.resolve();
        await releaseFirstCommit.promise;
      }
      await originalExecute(sql, params);
    };
    const backend = createLocalDataSqliteBackend({ driver });

    const firstCommit = backend.commitAtomic([{
      type: 'set',
      key: rowA.key,
      value: rowA
    }], {
      domain: 'chat',
      version: 1,
      commitId: 'first',
      committedAt: 1
    });
    await firstCommitPaused.promise;
    const secondCommit = backend.commitAtomic([{
      type: 'set',
      key: rowB.key,
      value: rowB
    }], {
      domain: 'chat',
      version: 1,
      commitId: 'second',
      committedAt: 2
    });

    await Promise.resolve();
    expect(driver.statements.filter((statement) => statement.sql === 'BEGIN IMMEDIATE')).toHaveLength(1);

    releaseFirstCommit.resolve();
    await Promise.all([firstCommit, secondCommit]);

    expect(driver.statements.map((statement) => statement.sql).filter((sql) => (
      sql === 'BEGIN IMMEDIATE' || sql === 'COMMIT'
    ))).toEqual([
      'BEGIN IMMEDIATE',
      'COMMIT',
      'BEGIN IMMEDIATE',
      'COMMIT'
    ]);
  });
});
