import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../types/domain';
import { commitChatConversationRowChangesIfActive } from './chat/localData';
import {
  buildConversationLocalDataProjection,
  buildConversationLocalDataUnitOfWork,
  getChatDomainMetaLocalDataRef,
  getConversationCatalogLocalDataRef,
  getConversationRecordLocalDataRef,
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  LOCAL_DATA_SCHEMA_VERSION,
  type ChatDomainMetaRow,
  type CommitPointerRow,
  type ConversationCatalogRow,
  type ConversationRecordRow,
  type LocalDataActiveDataSourceRow,
  type LocalDataStoredRow
} from '../engines/localData';

const persistenceMocks = vi.hoisted(() => ({
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  kvDel: vi.fn(),
  kvApplyMutations: vi.fn(),
  kvReplaceAll: vi.fn(),
  kvEntries: vi.fn(),
  kvKeys: vi.fn(),
  kvKeysWithPrefix: vi.fn(),
  getPersistenceLocalDataCommitMode: vi.fn(() => 'transactional'),
  withExclusiveKvWriteGate: vi.fn(async (run: (token: unknown) => unknown) => run({})),
  acquireExclusiveKvWriteGate: vi.fn(async () => ({ token: {}, release: vi.fn() }))
}));

vi.mock('../infrastructure/persistence', () => persistenceMocks);

function createMemoryKv(initialEntries: Array<[string, unknown]> = []) {
  const values = new Map<string, unknown>(initialEntries);
  persistenceMocks.kvGet.mockImplementation(async (key: string) => values.get(key) ?? null);
  persistenceMocks.kvSet.mockImplementation(async (key: string, value: unknown) => {
    values.set(key, value);
  });
  persistenceMocks.kvDel.mockImplementation(async (key: string) => {
    values.delete(key);
  });
  persistenceMocks.kvApplyMutations.mockImplementation(
    async (mutations: Array<{ type: 'set' | 'delete'; key: string; value?: unknown }>) => {
      for (const mutation of mutations) {
        if (mutation.type === 'set') values.set(mutation.key, mutation.value);
        else values.delete(mutation.key);
      }
    }
  );
  persistenceMocks.kvKeys.mockImplementation(async () => Array.from(values.keys()));
  persistenceMocks.kvKeysWithPrefix.mockImplementation(async (prefix: string) =>
    Array.from(values.keys()).filter((key) => key.startsWith(prefix))
  );
  return values;
}

function buildConversation(id: string, messageIds: string[], updatedAt = 1): Conversation {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    activeProjectId: null,
    draft: `${id}-draft`,
    pinnedAt: null,
    updatedAt,
    messages: messageIds.map((messageId) => ({
      id: messageId,
      role: 'user' as const,
      content: messageId,
      timestamp: 1
    }))
  };
}

function seedActiveLocalDataChatRepository(
  values: Map<string, unknown>,
  conversations: Conversation[],
  activeConversationId: string | null,
  committedAt = 100
) {
  const commitPointer: CommitPointerRow = {
    domain: 'chat',
    version: LOCAL_DATA_SCHEMA_VERSION,
    committedAt,
    commitId: `chat-seed-${committedAt}`
  };
  const unit = buildConversationLocalDataUnitOfWork({
    activeConversationId,
    conversations: conversations.map((conversation) => ({
      conversation,
      bodyState: 'complete' as const,
      version: LOCAL_DATA_SCHEMA_VERSION,
      committedAt
    })),
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: committedAt
  });
  for (const mutation of unit.mutations) {
    if (mutation.type === 'put' || mutation.type === 'restore') {
      values.set(mutation.row.key, mutation.row);
    }
  }
  values.set(getLocalDataCommitPointerKey('chat'), commitPointer);
  values.set(getLocalDataActiveDataSourceKey(), {
    schemaVersion: LOCAL_DATA_SCHEMA_VERSION,
    key: getLocalDataActiveDataSourceKey(),
    activeDataSource: 'repository',
    activeCommitId: commitPointer.commitId,
    stagingCommitId: null,
    updatedAt: committedAt,
    domains: { chat: commitPointer }
  } satisfies LocalDataActiveDataSourceRow);
}

function rawCatalog(values: Map<string, unknown>, conversationId: string) {
  return values.get(
    getLocalDataRowKey(getConversationCatalogLocalDataRef(conversationId))
  ) as LocalDataStoredRow<ConversationCatalogRow> | undefined;
}

function readCatalog(values: Map<string, unknown>, conversationId: string) {
  const row = rawCatalog(values, conversationId);
  if (!row || row.state !== 'complete') throw new Error(`catalog ${conversationId} is not complete`);
  return row.value;
}

function rawRecord(values: Map<string, unknown>, conversationId: string) {
  return values.get(
    getLocalDataRowKey(getConversationRecordLocalDataRef(conversationId))
  ) as LocalDataStoredRow<ConversationRecordRow> | undefined;
}

function readRecord(values: Map<string, unknown>, conversationId: string) {
  const row = rawRecord(values, conversationId);
  if (!row || row.state !== 'complete') throw new Error(`record ${conversationId} is not complete`);
  return row.value;
}

function readDomainMeta(values: Map<string, unknown>) {
  const row = values.get(
    getLocalDataRowKey(getChatDomainMetaLocalDataRef())
  ) as LocalDataStoredRow<ChatDomainMetaRow> | undefined;
  if (!row || row.state !== 'complete') throw new Error('chat domain meta is not complete');
  return row.value;
}

describe('commitChatConversationRowChangesIfActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistenceMocks.getPersistenceLocalDataCommitMode.mockReturnValue('transactional');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('record upserts', () => {
    it('writes one conversation body without rewriting unrelated conversation rows', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const conversationB = buildConversation('conv-b', ['b-1'], 11);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA, conversationB], 'conv-a');

      const catalogRowBefore = rawCatalog(values, 'conv-a');
      const recordRowBefore = rawRecord(values, 'conv-a');

      const wrote = await commitChatConversationRowChangesIfActive({
        changes: [{ type: 'upsertRecord', conversation: buildConversation('conv-b', ['b-1', 'b-2'], 25) }],
        activeConversationId: 'conv-a'
      });

      expect(wrote).toBe(true);
      expect(readRecord(values, 'conv-b').messages.map((m) => m.id)).toEqual(['b-1', 'b-2']);
      expect(readCatalog(values, 'conv-b').messageCount).toBe(2);
      // conv-a rows are byte-for-byte untouched (same object references).
      expect(rawCatalog(values, 'conv-a')).toBe(catalogRowBefore);
      expect(rawRecord(values, 'conv-a')).toBe(recordRowBefore);
    });

    it('writes the conversation body and active pointer in a single atomic commit', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA], 'conv-a');
      persistenceMocks.kvApplyMutations.mockClear();

      const newConversation = buildConversation('conv-b', ['b-1'], 25);
      await commitChatConversationRowChangesIfActive({
        changes: [{ type: 'upsertRecord', conversation: newConversation }],
        // creating a conversation and selecting it: the row and the pointer move together.
        activeConversationId: 'conv-b'
      });

      expect(persistenceMocks.kvApplyMutations).toHaveBeenCalledTimes(1);
      const [mutations] = persistenceMocks.kvApplyMutations.mock.calls[0] as [
        Array<{ type: string; key: string }>
      ];
      const writtenKeys = mutations.filter((m) => m.type === 'set').map((m) => m.key);
      expect(writtenKeys).toContain(getLocalDataRowKey(getChatDomainMetaLocalDataRef()));
      expect(writtenKeys).toContain(getLocalDataRowKey(getConversationCatalogLocalDataRef('conv-b')));
      expect(writtenKeys).toContain(getLocalDataRowKey(getConversationRecordLocalDataRef('conv-b')));
      expect(readDomainMeta(values).activeConversationId).toBe('conv-b');
    });

    it('keeps the active pointer and counts intact when editing a non-active conversation', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const conversationB = buildConversation('conv-b', ['b-1'], 11);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA, conversationB], 'conv-a');

      await commitChatConversationRowChangesIfActive({
        changes: [{ type: 'upsertRecord', conversation: buildConversation('conv-b', ['b-1', 'b-2'], 25) }],
        activeConversationId: 'conv-a'
      });

      const meta = readDomainMeta(values);
      expect(meta.activeConversationId).toBe('conv-a');
      expect(meta.activeConversationCount).toBe(2);
      expect(meta.totalConversationCount).toBe(2);
    });

    it('returns false without writing when the chat repository is not active', async () => {
      const values = createMemoryKv();
      const wrote = await commitChatConversationRowChangesIfActive({
        changes: [{ type: 'upsertRecord', conversation: buildConversation('conv-a', ['a-1']) }],
        activeConversationId: 'conv-a'
      });
      expect(wrote).toBe(false);
      expect(persistenceMocks.kvApplyMutations).not.toHaveBeenCalled();
      expect(values.size).toBe(0);
    });

    it('serializes concurrent writes so domain-meta counts cannot lose an update', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA], 'conv-a');

      // Two brand-new conversations committed concurrently. Without a shared
      // serialization gate, both reads would observe only {conv-a} and the second
      // commit would clobber the first's domain-meta count.
      await Promise.all([
        commitChatConversationRowChangesIfActive({
          changes: [{ type: 'upsertRecord', conversation: buildConversation('conv-b', ['b-1'], 20) }],
          activeConversationId: 'conv-a'
        }),
        commitChatConversationRowChangesIfActive({
          changes: [{ type: 'upsertRecord', conversation: buildConversation('conv-c', ['c-1'], 21) }],
          activeConversationId: 'conv-a'
        })
      ]);

      expect(readRecord(values, 'conv-b').messages.map((m) => m.id)).toEqual(['b-1']);
      expect(readRecord(values, 'conv-c').messages.map((m) => m.id)).toEqual(['c-1']);
      const meta = readDomainMeta(values);
      expect(meta.activeConversationCount).toBe(3);
      expect(meta.totalConversationCount).toBe(3);
      expect(meta.activeConversationId).toBe('conv-a');
    });
  });

  describe('metadata upserts', () => {
    it('writes the catalog metadata fact without touching the message record row', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA], 'conv-a');

      const recordRowBefore = rawRecord(values, 'conv-a');
      const renamed: Conversation = { ...conversationA, title: 'Renamed', pinnedAt: 42, updatedAt: 30 };
      const wrote = await commitChatConversationRowChangesIfActive({
        changes: [{ type: 'upsertMetadata', conversation: renamed }],
        activeConversationId: 'conv-a'
      });

      expect(wrote).toBe(true);
      const catalog = readCatalog(values, 'conv-a');
      expect(catalog.title).toBe('Renamed');
      expect(catalog.pinnedAt).toBe(42);
      // message count is preserved from the existing catalog, not recomputed from an empty body.
      expect(catalog.messageCount).toBe(1);
      expect(rawRecord(values, 'conv-a')).toBe(recordRowBefore);
    });

    it('preserves quarantined and total counts for an active repository that holds an incomplete catalog', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA], 'conv-a');

      // A migrated conversation whose body never hydrated: a complete catalog row
      // in the `incomplete` state with no record row. Migration validation counts
      // it as quarantined, so a metadata write must not erase that fact.
      const quarantined = buildConversationLocalDataProjection({
        conversation: buildConversation('conv-q', [], 5),
        bodyState: 'incomplete',
        expectedMessageCount: 3,
        expectedLatestMessageTimestamp: 9,
        version: LOCAL_DATA_SCHEMA_VERSION,
        committedAt: 100,
        missingKeys: ['chat-conversation-record-v1:conv-q']
      });
      values.set(quarantined.catalogRow.key, quarantined.catalogRow);

      await commitChatConversationRowChangesIfActive({
        changes: [{ type: 'upsertMetadata', conversation: { ...conversationA, title: 'Renamed', updatedAt: 30 } }],
        activeConversationId: 'conv-a'
      });

      const meta = readDomainMeta(values);
      expect(meta.activeConversationCount).toBe(1);
      expect(meta.quarantinedConversationCount).toBe(1);
      expect(meta.totalConversationCount).toBe(2);
    });
  });

  describe('deletes', () => {
    it('tombstones one conversation catalog and record and drops it from the counts', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const conversationB = buildConversation('conv-b', ['b-1'], 11);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA, conversationB], 'conv-a');

      const catalogRowABefore = rawCatalog(values, 'conv-a');

      const wrote = await commitChatConversationRowChangesIfActive({
        changes: [{ type: 'delete', conversationId: 'conv-b' }],
        activeConversationId: 'conv-a'
      });

      expect(wrote).toBe(true);
      expect(rawCatalog(values, 'conv-b')?.state).toBe('deleted');
      expect(rawRecord(values, 'conv-b')?.state).toBe('deleted');
      // conv-a is untouched and the counts only reflect the survivor.
      expect(rawCatalog(values, 'conv-a')).toBe(catalogRowABefore);
      const meta = readDomainMeta(values);
      expect(meta.activeConversationId).toBe('conv-a');
      expect(meta.activeConversationCount).toBe(1);
      expect(meta.totalConversationCount).toBe(1);
    });

    it('records the active pointer verbatim when the caller moves it off a deleted conversation', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const conversationB = buildConversation('conv-b', ['b-1'], 11);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA, conversationB], 'conv-a');

      // The store moves the active pointer off conv-a before deleting it.
      const wrote = await commitChatConversationRowChangesIfActive({
        changes: [{ type: 'delete', conversationId: 'conv-a' }],
        activeConversationId: 'conv-b'
      });

      expect(wrote).toBe(true);
      expect(rawCatalog(values, 'conv-a')?.state).toBe('deleted');
      const meta = readDomainMeta(values);
      expect(meta.activeConversationId).toBe('conv-b');
      expect(meta.activeConversationCount).toBe(1);
    });
  });

  describe('pointer-only moves', () => {
    it('moves only the domain-meta active pointer and leaves conversation rows untouched', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const conversationB = buildConversation('conv-b', ['b-1'], 11);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA, conversationB], 'conv-a');

      const catalogA = rawCatalog(values, 'conv-a');
      const catalogB = rawCatalog(values, 'conv-b');

      const wrote = await commitChatConversationRowChangesIfActive({
        changes: [],
        activeConversationId: 'conv-b'
      });

      expect(wrote).toBe(true);
      expect(readDomainMeta(values).activeConversationId).toBe('conv-b');
      expect(rawCatalog(values, 'conv-a')).toBe(catalogA);
      expect(rawCatalog(values, 'conv-b')).toBe(catalogB);
    });
  });

  describe('multi-conversation batches', () => {
    it('writes several changed conversations and one refreshed domain meta in a single commit', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const conversationB = buildConversation('conv-b', ['b-1'], 11);
      const conversationC = buildConversation('conv-c', ['c-1'], 12);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA, conversationB, conversationC], 'conv-a');
      persistenceMocks.kvApplyMutations.mockClear();

      const wrote = await commitChatConversationRowChangesIfActive({
        changes: [
          { type: 'upsertRecord', conversation: buildConversation('conv-b', ['b-1', 'b-2'], 25) },
          { type: 'upsertRecord', conversation: buildConversation('conv-c', ['c-1', 'c-2'], 26) }
        ],
        activeConversationId: 'conv-a'
      });

      expect(wrote).toBe(true);
      expect(persistenceMocks.kvApplyMutations).toHaveBeenCalledTimes(1);
      expect(readRecord(values, 'conv-b').messages.map((m) => m.id)).toEqual(['b-1', 'b-2']);
      expect(readRecord(values, 'conv-c').messages.map((m) => m.id)).toEqual(['c-1', 'c-2']);
      const meta = readDomainMeta(values);
      expect(meta.activeConversationCount).toBe(3);
      expect(meta.totalConversationCount).toBe(3);
    });

    it('mixes an upsert and a tombstone in one commit', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const conversationB = buildConversation('conv-b', ['b-1'], 11);
      const conversationC = buildConversation('conv-c', ['c-1'], 12);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA, conversationB, conversationC], 'conv-a');
      persistenceMocks.kvApplyMutations.mockClear();

      const wrote = await commitChatConversationRowChangesIfActive({
        changes: [
          { type: 'delete', conversationId: 'conv-c' },
          { type: 'upsertRecord', conversation: buildConversation('conv-b', ['b-1', 'b-2'], 25) }
        ],
        activeConversationId: 'conv-a'
      });

      expect(wrote).toBe(true);
      expect(persistenceMocks.kvApplyMutations).toHaveBeenCalledTimes(1);
      expect(rawCatalog(values, 'conv-c')?.state).toBe('deleted');
      expect(readRecord(values, 'conv-b').messages.map((m) => m.id)).toEqual(['b-1', 'b-2']);
      const meta = readDomainMeta(values);
      expect(meta.activeConversationCount).toBe(2);
      expect(meta.totalConversationCount).toBe(2);
    });

    it('throws when a batch writes the same conversation twice and writes nothing', async () => {
      const conversationA = buildConversation('conv-a', ['a-1'], 10);
      const conversationB = buildConversation('conv-b', ['b-1'], 11);
      const values = createMemoryKv();
      seedActiveLocalDataChatRepository(values, [conversationA, conversationB], 'conv-a');
      persistenceMocks.kvApplyMutations.mockClear();

      await expect(commitChatConversationRowChangesIfActive({
        changes: [
          { type: 'upsertRecord', conversation: buildConversation('conv-b', ['b-1', 'b-2'], 25) },
          { type: 'delete', conversationId: 'conv-b' }
        ],
        activeConversationId: 'conv-a'
      })).rejects.toThrow(/same conversation twice/);
      expect(persistenceMocks.kvApplyMutations).not.toHaveBeenCalled();
    });
  });
});
