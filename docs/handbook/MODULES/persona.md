# Persona persistence

The persona domain owns the collaborator/persona **directory rows** — the persona profile facts
(identity, settings, the active-collaborator pointer). The long memory-document **bodies** a
persona references are NOT stored here; they live in the document domain and are reached through a
bridge.

## Boundary

The dependency runs persona → bridge → document body, one way:

- **`stores/persona/` (this folder)** owns persona directory rows and reads the stored
  active-collaborator pointer verbatim (it does not guess "the first persona"). Its row engine
  imports the memory-ref bridge to strip / restore memory bodies while building persona rows.
- **`personaMemoryReferenceDocPersistence.ts` (left in place)** is the bridge: persona's
  consumer-layer over the document body owner. It is imported *by* the persona row engine, and it
  imports the document body owner — it is never a body owner itself, so it stays a top-level
  module rather than moving into this folder.
- **`personaStore.ts` (left in place)** is the Zustand store; hydration/active-pointer resolution
  is store-entry orchestration, not persistence, so it stays out of the folder.

## Layout

```
src/stores/persona/
  index.ts            — barrel re-export of the folder
  localData.ts        — the persona row engine: read persona state, commit persona row changes
  migrationPlanner.ts — commit a staged migration of legacy persona rows (renamed)
src/stores/personaPersistenceCommitQueue.ts   — one binding over the shared stores/_commitQueue
src/stores/personaLocalDataPersistence.ts      — re-export shim → persona/localData
src/stores/personaMigrationPersistence.ts      — re-export shim → persona/migrationPlanner
```

The migration planner builds and commits a staged unit of work through the migration backend; it
does not write the active persona repository or activate the domain by itself. The two old
top-level files are one-line `export *` shims so import sites do not churn; new code imports from
`stores/persona`. Follows the persistence-folder convention in [runtime.md](runtime.md).
