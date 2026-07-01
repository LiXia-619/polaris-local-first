# Runtime persistence

How the runtime domain — providers, MCP servers, web search / WebDAV config, image & voice
settings, companion connections, trigger rules, and the active-provider pointer — is read,
written, and migrated. It is the reference layout for every domain's persistence folder.

## Layout

```
src/stores/runtime/
  index.ts            — public facade: RuntimePayload, normalizeRuntimePayload, hydrateFromDb, persistToDb
  localData.ts        — the LocalData row engine: read the active rows, value-diff and commit row changes
  migrationPlanner.ts — stage a migration of the legacy runtime-providers-v2 payload into LocalData rows
src/stores/runtimePersistenceCommitQueue.ts   — one binding over the shared stores/_commitQueue
src/stores/runtimeStorePersistence.ts         — re-export shim → runtime/index
src/stores/runtimeLocalDataPersistence.ts     — re-export shim → runtime/localData
src/stores/runtimeMigrationPersistence.ts     — re-export shim → runtime/migrationPlanner
```

The three old top-level files are kept as one-line `export *` shims. They are **not** a
compatibility layer for old data — they exist only so the domain's ~12 import sites do not churn
while the implementation moves into the folder. New code should import from `stores/runtime`.

## The three pieces

- **`index.ts` (facade).** The store-facing API. `RuntimePayload` is the whole runtime settings
  object; `normalizeRuntimePayload` fills defaults and strips retired legacy providers;
  `hydrateFromDb` reads the LocalData layer (falling back to the legacy `runtime-providers-v2` KV
  key only for not-yet-activated installs); `persistToDb` writes through the row engine inside the
  domain commit queue.
- **`localData.ts` (row engine).** The current source of truth. It reads the active runtime rows
  (partitioning sealed historical lifecycle rows out of live hydration), and writes by
  value-diffing the desired payload against the persisted rows so only changed objects are
  upserted or tombstoned. The first ordinary save self-activates the runtime domain from its own
  committed rows. Read and write share one small predicate (`isRuntimeObjectKind`).
- **`migrationPlanner.ts` (migration).** Builds and commits a staged migration unit of work for
  the legacy payload, using the migration backend rather than the active runtime repository. It is
  reached only from the explicit migration/promotion path, never from an ordinary save, and it
  does not activate the runtime domain by itself. (Renamed from `runtimeMigrationPersistence` so
  the name no longer implies it owns ordinary persistence.)

## Concurrency

All commits run through `runExclusiveRuntimePersistenceCommit`, a per-domain serializer created
from the shared `stores/_commitQueue.ts` factory. Queues are per-domain by design — a runtime
save must not block a chat save — so each domain owns its own instance.

## Why `localData.ts` and not `read.ts` / `write.ts`

The runtime LocalData engine's read and write paths are one cohesive unit that shares helpers and
a value-diff model; splitting them into separate files would fragment that unit and add
cross-imports for a marginal gain. `localData.ts` keeps the engine whole. If a domain's read and
write are genuinely independent, that domain's folder can use `read.ts` / `write.ts` instead — the
folder shape is the contract, the internal file split follows the code.
