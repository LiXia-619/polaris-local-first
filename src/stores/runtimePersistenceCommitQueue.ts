import { createExclusiveCommitQueue } from './_commitQueue';

/** Exclusive serializer for runtime persistence commits — see ./_commitQueue. */
export const runExclusiveRuntimePersistenceCommit = createExclusiveCommitQueue();
