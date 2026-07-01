import { createExclusiveCommitQueue } from './_commitQueue';

/** Exclusive serializer for persona persistence commits — see ./_commitQueue. */
export const runExclusivePersonaPersistenceCommit = createExclusiveCommitQueue();
