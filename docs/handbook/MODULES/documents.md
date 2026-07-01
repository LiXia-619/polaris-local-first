# Document body persistence

The document domain owns **body content** — the long text bodies that other domains attach by
reference: persona memory document bodies and workspace reference document bodies. It stores them
as LocalData document rows, keyed by id, so a directory row in another domain can point at a body
without inlining it.

## The three-way boundary

This is the part that is easy to confuse, so it is drawn explicitly:

1. **Document body owner — `stores/document/`.** Reads and writes the document-domain body rows.
   This is the only thing relocated here.
2. **Workspace reference doc *directory* — owned by `collection`.** The collection domain owns the
   directory rows for workspace reference docs (title, ordering, the body's id). It does not store
   the body.
3. **Collection→document bridge — `workspaceReferenceDocContentPersistence.ts` (left in place).**
   A cross-cutting content-access layer that reads/writes a workspace doc's body *through* the
   document body owner and falls back to the legacy chunked KV. It is a consumer of
   `stores/document`, not part of it, so it stays a top-level module rather than moving into the
   folder.

The dependency is one-way: `workspaceReferenceDocContentPersistence` and
`personaMemoryReferenceDocPersistence` import the document body owner; the body owner imports
neither. Relocating the body owner therefore does not disturb the bridge.

## Layout

```
src/stores/document/
  index.ts            — barrel re-export of the folder
  localData.ts        — the body row engine: read a body, list body ids, commit body row changes
  migrationPlanner.ts — commit a staged migration of legacy document bodies (renamed)
src/stores/documentPersistenceCommitQueue.ts   — one binding over the shared stores/_commitQueue
src/stores/documentLocalDataPersistence.ts      — re-export shim → document/localData
src/stores/documentMigrationPersistence.ts      — re-export shim → document/migrationPlanner
```

The migration planner builds and commits a staged unit of work through the migration backend; it
does not write the active document repository or activate the domain by itself. The two old
top-level files are one-line `export *` shims so import sites do not churn; new code imports from
`stores/document`. Follows the persistence-folder convention in [runtime.md](runtime.md).
