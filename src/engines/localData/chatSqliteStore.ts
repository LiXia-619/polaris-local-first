import { typedChatSqliteRawSql, typedChatSqliteSql } from './chatSqliteSchema';
import {
  assertWindowLimit,
  conversationCreatedAt,
  deserializeConversationMetadata,
  deserializeMessagePayload,
  latestMessageTimestamp,
  nullableNumber,
  nullableString,
  readCount,
  requireNumber,
  requireString,
  serializeConversationMetadata,
  serializeMessagePayload,
  timestamp
} from './chatSqliteSerialization';
import type {
  TypedChatSqliteStore,
  TypedChatSqliteStoreOptions
} from './chatSqliteTypes';

export type {
  TypedChatSqliteConversationMetadata,
  TypedChatSqliteConversationSummary,
  TypedChatSqliteMessageWindow,
  TypedChatSqliteStore,
  TypedChatSqliteStoreOptions
} from './chatSqliteTypes';

export { typedChatSqliteRawSql, typedChatSqliteSql } from './chatSqliteSchema';

export function createTypedChatSqliteStore(
  options: TypedChatSqliteStoreOptions
): TypedChatSqliteStore {
  let schemaReady: Promise<void> | null = null;
  let transactionTail: Promise<void> = Promise.resolve();

  const initialize = async () => {
    if (!schemaReady) {
      schemaReady = (async () => {
        await options.driver.execute(typedChatSqliteRawSql.createConversationTable);
        await options.driver.execute(typedChatSqliteRawSql.createMessageTable);
        await options.driver.execute(typedChatSqliteRawSql.createConversationUpdatedIndex);
        await options.driver.execute(typedChatSqliteRawSql.createMessageConversationSeqIndex);
      })();
    }
    return schemaReady;
  };

  const runExclusiveTransaction = async (transaction: () => Promise<void>) => {
    const previousTail = transactionTail;
    let releaseTail: () => void;
    transactionTail = new Promise<void>((resolve) => {
      releaseTail = resolve;
    });

    await previousTail;
    try {
      await transaction();
    } finally {
      releaseTail!();
    }
  };

  return {
    initialize,

    async writeConversations(conversations) {
      await initialize();
      await runExclusiveTransaction(async () => {
        await options.driver.execute('BEGIN IMMEDIATE');
        try {
          for (const conversation of conversations) {
            await options.driver.execute(typedChatSqliteRawSql.upsertConversation, [
              conversation.id,
              conversation.title,
              conversation.kind ?? 'direct',
              conversation.collaboratorId,
              conversation.groupRoomId ?? null,
              conversation.activeProjectId ?? null,
              conversation.pinnedAt,
              conversationCreatedAt(conversation),
              timestamp(conversation.updatedAt, latestMessageTimestamp(conversation.messages)),
              serializeConversationMetadata(conversation)
            ]);
            await options.driver.execute(typedChatSqliteRawSql.deleteConversationMessages, [
              conversation.id
            ]);
            for (const [index, message] of conversation.messages.entries()) {
              const messageTimestamp = timestamp(message.timestamp);
              await options.driver.execute(typedChatSqliteRawSql.upsertMessage, [
                message.id,
                conversation.id,
                index,
                message.role,
                message.content,
                message.thinkingText ?? '',
                messageTimestamp,
                messageTimestamp,
                serializeMessagePayload(message, conversation.id)
              ]);
            }
          }
          await options.driver.execute('COMMIT');
        } catch (error) {
          try {
            await options.driver.execute('ROLLBACK');
          } catch {
            // The write failure above is the durable evidence callers need.
          }
          throw error;
        }
      });
    },

    async readConversationSummaries() {
      await initialize();
      const rows = await options.driver.query(typedChatSqliteRawSql.readConversationSummaries);
      return rows.map((row) => ({
        id: requireString(row, 'id', 'conversation summary'),
        title: requireString(row, 'title', 'conversation summary'),
        kind: requireString(row, 'kind', 'conversation summary') === 'group' ? 'group' : 'direct',
        collaboratorId: nullableString(row, 'collaborator_id'),
        groupRoomId: nullableString(row, 'group_room_id'),
        activeProjectId: nullableString(row, 'active_project_id'),
        pinnedAt: nullableNumber(row, 'pinned_at'),
        createdAt: requireNumber(row, 'created_at', 'conversation summary'),
        updatedAt: requireNumber(row, 'updated_at', 'conversation summary'),
        messageCount: readCount(row),
        latestMessageTimestamp: requireNumber(
          row,
          'latest_message_timestamp',
          'conversation summary'
        )
      }));
    },

    async readConversationMetadata(conversationId) {
      await initialize();
      const rows = await options.driver.query(typedChatSqliteRawSql.readConversationMetadata, [
        conversationId
      ]);
      const row = rows[0];
      return row ? deserializeConversationMetadata(row, conversationId) : null;
    },

    async readMessageWindow(conversationId, options_) {
      assertWindowLimit(options_.limit);
      await initialize();
      const conversationRows = await options.driver.query(typedChatSqliteRawSql.readConversationExists, [
        conversationId
      ]);
      if (!conversationRows[0]) {
        return {
          status: 'missing',
          messages: [],
          expectedCount: 0,
          nextBeforeSeq: null
        };
      }

      const countRows = await options.driver.query(typedChatSqliteRawSql.readMessageCount, [
        conversationId
      ]);
      const expectedCount = readCount(countRows[0]);
      const queryLimit = options_.limit + 1;
      const rows = typeof options_.beforeSeq === 'number'
        ? await options.driver.query(typedChatSqliteRawSql.readMessagesBeforeSeq, [
            conversationId,
            options_.beforeSeq,
            queryLimit
          ])
        : await options.driver.query(typedChatSqliteRawSql.readRecentMessages, [
            conversationId,
            queryLimit
          ]);
      const hasMore = rows.length > options_.limit;
      const selectedRows = rows.slice(0, options_.limit);
      const messages = selectedRows
        .map((row) => deserializeMessagePayload(row, conversationId))
        .reverse();
      const oldestSeq = selectedRows.length > 0
        ? requireNumber(selectedRows[selectedRows.length - 1], 'seq', conversationId)
        : null;

      return {
        status: hasMore ? 'partial' : 'loaded',
        messages,
        expectedCount,
        nextBeforeSeq: hasMore ? oldestSeq : null
      };
    }
  };
}
