import { createExclusiveCommitQueue } from './_commitQueue';

/** Exclusive serializer for collection persistence commits — see ./_commitQueue. */
export const runExclusiveCollectionPersistenceCommit = createExclusiveCommitQueue();
