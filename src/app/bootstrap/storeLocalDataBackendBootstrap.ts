import type { LocalDataBackend } from '../../engines/localData';
import {
  canUseNativeLocalDataSqlite,
  createNativeLocalDataSqliteBackend
} from '../../native/localDataSqlite';
import { installStoreLocalDataBackend } from '../../stores/storeLocalDataBackendHost';

export type RuntimeStoreLocalDataBackendKind = 'native-sqlite' | 'kv-default';

export type RuntimeStoreLocalDataBackendInstall = {
  installed: boolean;
  backend: RuntimeStoreLocalDataBackendKind;
};

/**
 * Composition root for the store LocalData backend, run once at app startup before any store
 * hydrates or persists.
 *
 * On a native platform whose SQLite plugin is available, install the native SQLite backend as THE
 * single current fact source: every host-routed read/write/discovery then lands in SQLite.
 * Everywhere else (web, tests, non-native shells) install nothing, so the host keeps its KV
 * default. KV/memory stays a fallback for those environments, never a second concurrent source
 * alongside SQLite.
 *
 * This only CHOOSES where ordinary reads/writes land. It never promotes, migrates, or copies legacy
 * data — moving old data into SQLite-backed rows stays on the explicit migration/import boundary,
 * driven elsewhere. A fresh install simply starts writing its rows into the installed backend and
 * self-activates from those committed rows on first save.
 */
export function installRuntimeStoreLocalDataBackend(options: {
  canUseNativeSqlite?: () => boolean;
  createNativeBackend?: () => LocalDataBackend;
  install?: (backend: LocalDataBackend) => void;
} = {}): RuntimeStoreLocalDataBackendInstall {
  const canUseNativeSqlite = options.canUseNativeSqlite ?? canUseNativeLocalDataSqlite;
  if (!canUseNativeSqlite()) {
    return { installed: false, backend: 'kv-default' };
  }

  const createNativeBackend = options.createNativeBackend ?? createNativeLocalDataSqliteBackend;
  const install = options.install ?? installStoreLocalDataBackend;
  install(createNativeBackend());
  return { installed: true, backend: 'native-sqlite' };
}
