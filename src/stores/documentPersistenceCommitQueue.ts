import { createExclusiveCommitQueue } from './_commitQueue';

/** Exclusive serializer for document persistence commits — see ./_commitQueue. */
export const runExclusiveDocumentPersistenceCommit = createExclusiveCommitQueue();
