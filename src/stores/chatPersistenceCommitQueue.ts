import { createExclusiveCommitQueue } from './_commitQueue';

/** Exclusive serializer for chat persistence commits — see ./_commitQueue. */
export const runExclusiveChatPersistenceCommit = createExclusiveCommitQueue();
