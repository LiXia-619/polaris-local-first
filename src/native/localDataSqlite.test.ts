import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCompleteLocalDataRow,
  createLocalDataRepository,
  getLocalDataRowKey,
  type LocalDataRef
} from '../engines/localData';
import { localDataSqliteSql } from '../engines/localData/localDataSqliteBackend';
import { typedChatSqliteSql } from '../engines/localData/chatSqliteStore';

const capacitorState = vi.hoisted(() => ({
  nativePlatform: false,
  platform: 'web',
  pluginAvailable: false,
  plugin: {
    execute: vi.fn(),
    query: vi.fn()
  }
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => capacitorState.nativePlatform,
    getPlatform: () => capacitorState.platform,
    isPluginAvailable: (name: string) => capacitorState.pluginAvailable && name === 'LocalDataSqlite'
  },
  registerPlugin: vi.fn(() => capacitorState.plugin)
}));

const conversationRef: LocalDataRef = {
  domain: 'chat',
  kind: 'conversationRecord',
  id: 'native-sqlite-c-1'
};

function normalizeSql(sql: string) {
  return sql.trim().replace(/\s+/g, ' ');
}

describe('native LocalData SQLite driver', () => {
  beforeEach(() => {
    capacitorState.nativePlatform = false;
    capacitorState.platform = 'web';
    capacitorState.pluginAvailable = false;
    capacitorState.plugin.execute.mockReset();
    capacitorState.plugin.query.mockReset();
    vi.resetModules();
  });

  it('is available only when the native LocalDataSqlite plugin is registered', async () => {
    const { canUseNativeLocalDataSqlite, getNativeLocalDataSqlitePlatform } = await import('./localDataSqlite');

    expect(canUseNativeLocalDataSqlite()).toBe(false);
    expect(getNativeLocalDataSqlitePlatform()).toBe(null);

    capacitorState.nativePlatform = true;
    capacitorState.platform = 'ios';
    capacitorState.pluginAvailable = true;
    expect(canUseNativeLocalDataSqlite()).toBe(true);
    expect(getNativeLocalDataSqlitePlatform()).toBe('ios');

    capacitorState.platform = 'android';
    expect(canUseNativeLocalDataSqlite()).toBe(true);
    expect(getNativeLocalDataSqlitePlatform()).toBe('android');
  });

  it('passes SQL and params through the Capacitor plugin driver', async () => {
    const { createNativeLocalDataSqliteDriver } = await import('./localDataSqlite');
    const driver = createNativeLocalDataSqliteDriver();
    capacitorState.plugin.query.mockResolvedValue({
      rows: [{ value_json: '{"ok":true}' }]
    });

    await driver.execute(localDataSqliteSql.deleteEntry, ['row-key']);
    await expect(driver.query(localDataSqliteSql.readEntry, ['row-key'])).resolves.toEqual([
      { value_json: '{"ok":true}' }
    ]);

    expect(capacitorState.plugin.execute).toHaveBeenCalledWith({
      sql: localDataSqliteSql.deleteEntry,
      params: ['row-key']
    });
    expect(capacitorState.plugin.query).toHaveBeenCalledWith({
      sql: localDataSqliteSql.readEntry,
      params: ['row-key']
    });
  });

  it('creates a repository backend over the native SQLite plugin', async () => {
    const row = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['native sqlite'] },
      version: 1,
      updatedAt: 1
    });
    const storedJsonByKey = new Map<string, string>();
    capacitorState.plugin.execute.mockImplementation(async ({ sql, params }) => {
      const normalizedSql = normalizeSql(sql);
      if (
        normalizedSql === localDataSqliteSql.createEntriesTable
        || normalizedSql === 'BEGIN IMMEDIATE'
        || normalizedSql === 'COMMIT'
      ) return;
      if (normalizedSql === localDataSqliteSql.upsertEntry) {
        const [key, valueJson] = params ?? [];
        if (typeof key !== 'string' || typeof valueJson !== 'string') throw new Error('bad params');
        storedJsonByKey.set(key, valueJson);
        return;
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });
    capacitorState.plugin.query.mockImplementation(async ({ sql, params }) => {
      if (normalizeSql(sql) !== localDataSqliteSql.readEntry) throw new Error(`unexpected SQL: ${sql}`);
      const [key] = params ?? [];
      const valueJson = typeof key === 'string' ? storedJsonByKey.get(key) : undefined;
      return {
        rows: valueJson ? [{ value_json: valueJson }] : []
      };
    });
    const { createNativeLocalDataSqliteBackend } = await import('./localDataSqlite');
    const repository = createLocalDataRepository({
      backend: createNativeLocalDataSqliteBackend(),
      now: () => 1,
      createCommitId: () => 'native-sqlite-commit'
    });

    await repository.commit({
      domain: 'chat',
      version: 1,
      mutations: [{ type: 'put', row }]
    });

    await expect(repository.read(conversationRef)).resolves.toEqual(expect.objectContaining({
      status: 'complete',
      value: { messages: ['native sqlite'] }
    }));
    expect(storedJsonByKey.has(getLocalDataRowKey(conversationRef))).toBe(true);
  });

  it('creates a typed chat store over the native SQLite plugin driver', async () => {
    capacitorState.plugin.execute.mockResolvedValue(undefined);
    const { createNativeTypedChatSqliteStore } = await import('./localDataSqlite');
    const store = createNativeTypedChatSqliteStore();

    await store.initialize();

    const executedSql = capacitorState.plugin.execute.mock.calls.map(([call]) => (
      normalizeSql(call.sql)
    ));
    expect(executedSql).toEqual(expect.arrayContaining([
      typedChatSqliteSql.createConversationTable,
      typedChatSqliteSql.createMessageTable,
      typedChatSqliteSql.createConversationUpdatedIndex,
      typedChatSqliteSql.createMessageConversationSeqIndex
    ]));
  });
});
