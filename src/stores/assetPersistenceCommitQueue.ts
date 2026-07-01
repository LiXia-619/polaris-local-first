import { createExclusiveCommitQueue } from './_commitQueue';

/** Exclusive serializer for asset persistence commits — see ./_commitQueue. */
export const runExclusiveAssetPersistenceCommit = createExclusiveCommitQueue();
