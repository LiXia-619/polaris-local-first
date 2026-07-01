# Collection persistence

The collection domain owns the workspace's object **directory rows** — code cards, image cards,
projects, project files, and the workspace-reference-doc directory entries (title, ordering, body
id). It is the first reshaped domain with a full four-layer boundary, so they are named here.

## The four boundaries

1. **Facade — `stores/collection/index.ts`** (was `collectionStorePersistence`). The store-facing
   read/write API. Imports the row engine and the document body bridge.
2. **Row engine — `stores/collection/localData.ts`** (was `collectionLocalDataPersistence`). The
   LocalData directory-row read/write. It returns stored owner facts verbatim — it never derives an
   owner from origin conversations during a read.
3. **Legacy read boundary — `collectionLegacyStateBoundary.ts` (left in place).** The single
   explicit reader of the old `collection-state-v2` KV state, used only by the migration planner.
   It is a deliberate, narrow legacy read surface, not part of the live engine, so it stays a
   top-level module.
4. **Document body bridge — `workspaceReferenceDocContentPersistence.ts` (left in place).** A
   workspace-doc's body is a document-domain fact; this bridge reads/writes it through the document
   body owner. The collection facade and engine consume the bridge; it is **not** a body owner and
   must not be folded into this domain.

## Layout

```
src/stores/collection/
  index.ts            — the facade (RUNTIME-style: the public read/write API)
  localData.ts        — the directory row engine
  migrationPlanner.ts — commit a staged migration of legacy collection rows (renamed)
src/stores/collectionPersistenceCommitQueue.ts   — one binding over the shared stores/_commitQueue
src/stores/collectionStorePersistence.ts          — re-export shim → collection/index
src/stores/collectionLocalDataPersistence.ts      — re-export shim → collection/localData
src/stores/collectionMigrationPersistence.ts      — re-export shim → collection/migrationPlanner
```

## A note on mocking after the move

Because the facade now imports the engine through the in-folder path (`./localData`) rather than
the old top-level path, a test that mocks the engine to intercept the facade's internal call must
mock the **real module** — `vi.doMock('./collection/localData', …)` — not the old
`./collectionLocalDataPersistence` shim. The shim re-exports, but the facade does not route through
it. (`collectionStorePersistence*.test.ts` were updated accordingly.)

The three old top-level files are one-line `export *` shims so import sites do not churn; new code
imports from `stores/collection`. Follows the persistence-folder convention in [runtime.md](runtime.md).
