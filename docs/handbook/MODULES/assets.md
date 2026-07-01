# Asset persistence

Where stored asset metadata rows (the owner reference + binary/preview size facts) are written
and migrated. Asset binaries themselves live in `src/infrastructure/assetStore.ts`, which is the
domain owner; this folder is only the LocalData row side.

## Layout

```
src/stores/asset/
  index.ts            — barrel re-export of the folder
  localData.ts        — the row engine: commit asset row upsert / delete / preview-cleared
  migrationPlanner.ts — commit a staged migration unit for legacy asset rows
src/stores/assetPersistenceCommitQueue.ts   — one binding over the shared stores/_commitQueue
src/stores/assetLocalDataPersistence.ts      — re-export shim → asset/localData
src/stores/assetMigrationPersistence.ts      — re-export shim → asset/migrationPlanner
```

Asset has **no store-facing facade** (unlike runtime's `index.ts`) — `assetStore` in the
infrastructure layer is the owner and the only consumer of the row engine. So the folder is just
the engine plus the migration planner, with `index.ts` as a plain barrel.

The migration planner builds and commits a staged unit of work through the migration backend. It
does not write the active asset repository or activate the asset domain by itself.

The two old top-level files are one-line `export *` shims so the existing import sites do not
churn; new code imports from `stores/asset`. Follows the persistence-folder convention documented
in [runtime.md](runtime.md).
