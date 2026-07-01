import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { localDataSqliteSql } from '../engines/localData/localDataSqliteBackend';

/**
 * Source-parity proof for the native LocalData SQLite plugins.
 *
 * The JS `createLocalDataSqliteBackend` driver only ever issues the statements declared in
 * `localDataSqliteSql` (plus the raw transaction controls). Each native plugin (iOS Swift,
 * Android Java) gates execution behind an explicit SQL allowlist, so any statement the JS
 * contract issues MUST also exist in the native plugin source — otherwise that call is rejected
 * as `disallowedSql` at runtime on a real device, even though every Node/JS test passes.
 *
 * This test reads the real native plugin sources and asserts the full LocalData SQLite statement
 * surface is present in both. It is a static parity guard, NOT a device runtime run: it proves the
 * native plugins KNOW every statement, not that a physical device executed them. Real iOS/Android
 * runtime execution remains a manually owed step (see
 * docs/open-source/native-sqlite-runtime-proof.md).
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function source(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

// Collapse native string-literal syntax (quotes + concatenation `+`) and whitespace so a SQL
// statement that is multi-line (Swift `"""`) or concatenated across pieces (Java `"..." + "..."`)
// flattens to the same single-spaced form `localDataSqliteSql` already stores.
function flattenNativeSource(contents: string) {
  return contents.replace(/["+]/g, ' ').replace(/\s+/g, ' ').trim();
}

const iosPluginPath = 'ios/App/CapApp-SPM/Sources/CapApp-SPM/LocalDataSqlitePlugin.swift';
const androidPluginPath = 'android/app/src/main/java/com/alyssa/polaris/LocalDataSqlitePlugin.java';

const nativePluginSources = [
  { platform: 'ios', source: source(iosPluginPath) },
  { platform: 'android', source: source(androidPluginPath) }
];

const nativePlugins = [
  ...nativePluginSources.map((plugin) => ({
    ...plugin,
    source: flattenNativeSource(plugin.source)
  }))
];

// Every statement the LocalData SQLite backend can issue: the declared statements plus the raw
// transaction controls used by commitAtomic.
const requiredStatements: Array<{ label: string; sql: string }> = [
  ...Object.entries(localDataSqliteSql).map(([label, sql]) => ({ label, sql })),
  { label: 'beginImmediate', sql: 'BEGIN IMMEDIATE' },
  { label: 'commit', sql: 'COMMIT' },
  { label: 'rollback', sql: 'ROLLBACK' }
];

describe('native LocalData SQLite plugin SQL parity', () => {
  it('canonicalizes insignificant punctuation whitespace before allowlist comparison', () => {
    // Native Java/Swift source formats SQL differently from the JS template strings. In particular,
    // Java string concatenation can produce `NOT NULL)` while JS sends `NOT NULL )`. The allowlist
    // must canonicalize spaces around SQL punctuation, not just collapse repeated whitespace.
    for (const plugin of nativePluginSources) {
      expect(plugin.source, `${plugin.platform} normalizeSql must strip punctuation whitespace`).toMatch(
        /\\\\s\*\(\[\(\),=\]\)\\\\s\*/
      );
      expect(plugin.source, `${plugin.platform} normalizeSql must keep SQL punctuation instead of deleting it`).toContain(
        '$1'
      );
    }
  });

  it('declares row discovery (listKeysWithPrefix) in both native plugins', () => {
    // The statement that was missing natively while every JS/Node test still passed: row discovery
    // over a key prefix. Without it the native plugin rejects discoverLocalDataDomainRefs / catalog
    // / asset row scans, so SQLite would be installed but unusable for ordinary reads.
    for (const plugin of nativePlugins) {
      expect(plugin.source, `${plugin.platform} missing listKeysWithPrefix SQL`).toContain(
        localDataSqliteSql.listKeysWithPrefix
      );
    }
  });

  it('covers the full LocalData SQLite statement surface in both native plugins', () => {
    for (const plugin of nativePlugins) {
      for (const statement of requiredStatements) {
        expect(
          plugin.source,
          `${plugin.platform} plugin is missing LocalData SQLite statement "${statement.label}": ${statement.sql}`
        ).toContain(statement.sql);
      }
    }
  });
});
