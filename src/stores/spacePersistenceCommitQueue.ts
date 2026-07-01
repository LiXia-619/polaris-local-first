import { createExclusiveCommitQueue } from './_commitQueue';

/** Exclusive serializer for space persistence commits — see ./_commitQueue. */
export const runExclusiveSpacePersistenceCommit = createExclusiveCommitQueue();
