/**
 * Per-domain exclusive commit serializer.
 *
 * Each persistence domain owns ONE queue instance so its concurrent product actions cannot
 * interleave their read-modify-write of shared rows (the domain-meta counts, active pointers, and
 * object rows). The whole-payload save path and the single-object row writer both route their
 * commits through the same queue, so a row write and a snapshot write can never overlap and lose a
 * count or a pointer.
 *
 * Queues are per-domain by design — a chat commit must not block a runtime commit — so each domain
 * calls `createExclusiveCommitQueue()` once to get its own serializer rather than sharing a global.
 */
export function createExclusiveCommitQueue() {
  let queue: Promise<unknown> = Promise.resolve();
  return function runExclusiveCommit<T>(operation: () => Promise<T>): Promise<T> {
    const queuedOperation = queue.catch(() => undefined).then(operation);
    queue = queuedOperation.catch(() => undefined);
    return queuedOperation;
  };
}
