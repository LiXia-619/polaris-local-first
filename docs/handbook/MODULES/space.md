# Space persistence

The space domain owns the workspace/theme **persistence** — reading and writing the space state
(theme, customization, display preferences) and migrating the legacy `polaris-space-store-v1`
payload. The space store also has a large family of UI **state** slices (frontstage, preview,
theme-session, skin actions, collaborator themes); those are deliberately left alone.

## What moved vs what stayed

Only the three persistence files moved. The rest of the `spaceStore*` family is store/UI state and
is **not** reorganized here — folding it in would mix a persistence relocation with a theme/UI
refactor.

```
src/stores/space/
  index.ts            — the facade (public read/write API; pulls in the theme/frontstage persistence slices)
  localData.ts        — the LocalData row engine
  migrationPlanner.ts — commit a staged migration of the legacy space payload (renamed)
src/stores/spacePersistenceCommitQueue.ts   — one binding over the shared stores/_commitQueue
src/stores/spaceStorePersistence.ts          — re-export shim → space/index
src/stores/spaceLocalDataPersistence.ts      — re-export shim → space/localData
src/stores/spaceMigrationPersistence.ts      — re-export shim → space/migrationPlanner
```

**Left top-level on purpose** (state slices and feature-specific persistence the facade composes,
not the core space persistence): `spaceStoreThemePersistence`, `spaceStoreFrontstagePersistence`,
`spaceStoreTheme*`, `spaceStoreFrontstage*`, `spaceStorePreviewState`, `spaceStoreDisplayPreferences`,
`spaceStoreCollaboratorThemes`, `spaceStoreSkinActions`, `spaceStoreTypes`, `spaceStore.ts`, and the
import/export entry `spaceStoreDataTransfer`.

The migration planner builds and commits a staged unit of work through the migration backend; it
does not write the active space repository or activate the domain by itself. The three old
top-level files are one-line `export *` shims so import sites do not churn; new code imports from
`stores/space`. Follows the persistence-folder convention in [runtime.md](runtime.md).
