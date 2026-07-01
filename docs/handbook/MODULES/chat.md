# Chat persistence

The chat domain is the largest and most-separated persistence layer: conversation catalog rows,
conversation record (body) rows, the active-conversation pointer, and lazy message loading. Unlike
runtime (one cohesive `localData.ts`), chat's read / snapshot-write / row-write paths are genuinely
distinct responsibilities, so the folder keeps them as separate files. This is the rule in action:
**the folder shape is the contract; the internal split follows the code** — runtime merges because
its engine is cohesive, chat stays split because its paths are not.

## Layout

```
src/stores/chat/
  index.ts            — the facade (was chatCurrentPersistence): the public read/write/serialize API
  localData.ts        — the in-folder barrel re-exporting read / snapshotWrite / rowWrite
  read.ts             — the LocalData read path (catalog + record hydration, message streaming)
  snapshotWrite.ts    — the whole-state snapshot writer
  rowWrite.ts         — the single-conversation row writer (the ordinary save path)
  writeHelpers.ts     — write helpers shared by snapshotWrite and rowWrite
  migrationPlanner.ts — the legacy migration dry-run/planner (was chatMigrationDryRunPersistence)
src/stores/chatPersistenceCommitQueue.ts   — one binding over the shared stores/_commitQueue
src/stores/chatCurrentPersistence.ts         — re-export shim → chat/index (17 external consumers)
src/stores/chatMigrationDryRunPersistence.ts — re-export shim → chat/migrationPlanner (2 consumers)
```

## Shims, and why only two

Only `chatCurrentPersistence` (17 external importers) and `chatMigrationDryRunPersistence` (2) have
consumers outside the chat persistence cluster, so only those two keep a re-export shim. The other
five files (`localData`, `read`, `snapshotWrite`, `rowWrite`, `writeHelpers`) had **zero** external
importers — they are purely internal — so they moved into the folder with no shim, and the three
test files that imported them directly were repointed to `stores/chat/...`.

## A note on mocking after the move

The facade routes saves through the in-folder barrel (`./localData`), not the old top-level path.
A test that mocks the barrel to assert routing must mock the **real module** —
`vi.mock('./chat/localData', …)` — not the removed `./chatLocalDataPersistence` path.
(`chatStatePersistRouting.test.ts` was updated accordingly.)

The migration planner stages and commits a unit of work through the migration backend; it does not
write the active chat repository or activate the domain by itself. New code imports from
`stores/chat`. Follows the persistence-folder convention in [runtime.md](runtime.md).
