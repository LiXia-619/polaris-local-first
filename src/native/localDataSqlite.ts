import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  createLocalDataSqliteBackend,
  type LocalDataSqliteDriver,
  type LocalDataSqliteQueryRow
} from '../engines/localData/localDataSqliteBackend';
import { createTypedChatSqliteStore } from '../engines/localData/chatSqliteStore';

type LocalDataSqlitePlugin = {
  execute(options: { sql: string; params?: readonly unknown[] }): Promise<void>;
  query(options: {
    sql: string;
    params?: readonly unknown[];
  }): Promise<{ rows?: LocalDataSqliteQueryRow[] }>;
};

const LocalDataSqlite = registerPlugin<LocalDataSqlitePlugin>('LocalDataSqlite');

export type NativeLocalDataSqlitePlatform = 'ios' | 'android';

export function getNativeLocalDataSqlitePlatform(): NativeLocalDataSqlitePlatform | null {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalDataSqlite')) {
    return null;
  }
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : null;
}

export function canUseNativeLocalDataSqlite() {
  return getNativeLocalDataSqlitePlatform() !== null;
}

export function createNativeLocalDataSqliteDriver(): LocalDataSqliteDriver {
  return {
    async execute(sql, params = []) {
      await LocalDataSqlite.execute({ sql, params });
    },

    async query<T extends LocalDataSqliteQueryRow = LocalDataSqliteQueryRow>(sql: string, params = []) {
      const result = await LocalDataSqlite.query({ sql, params });
      return (result.rows ?? []) as T[];
    }
  };
}

export function createNativeLocalDataSqliteBackend() {
  return createLocalDataSqliteBackend({
    driver: createNativeLocalDataSqliteDriver()
  });
}

export function createNativeTypedChatSqliteStore() {
  return createTypedChatSqliteStore({
    driver: createNativeLocalDataSqliteDriver()
  });
}
