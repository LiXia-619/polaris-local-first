import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { Conversation } from '../../types/domain';
import { createTypedChatSqliteStore } from './chatSqliteStore';
import type { LocalDataSqliteDriver, LocalDataSqliteQueryRow } from './localDataSqliteBackend';

/**
 * Exercises the typed chat SQLite store against a REAL in-memory SQLite engine
 * (`node:sqlite`), not the statement-level fake driver used by chatSqliteStore.test.ts.
 * The typed schema is where the SQL actually gets complex — JOIN + COUNT + GROUP BY for
 * summaries, `seq`-ordered windows with paging, `ON CONFLICT` upserts, and scoped message
 * replacement — so running the real store API on a real engine validates that the SQL is
 * correct, not just that the store emits the expected statements.
 */

function createNodeSqliteDriver(): LocalDataSqliteDriver {
  const db = new DatabaseSync(':memory:');
  return {
    async execute(sql: string, params: readonly unknown[] = []) {
      if (params.length === 0) {
        db.exec(sql);
        return;
      }
      db.prepare(sql).run(...(params as never[]));
    },
    async query<T extends LocalDataSqliteQueryRow = LocalDataSqliteQueryRow>(
      sql: string,
      params: readonly unknown[] = []
    ) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    }
  };
}

function conversation(args: {
  id: string;
  updatedAt: number;
  messageCount: number;
  draft?: string;
  pinnedAt?: number | null;
}): Conversation {
  return {
    id: args.id,
    title: `Title ${args.id}`,
    collaboratorId: 'pharos',
    draft: args.draft,
    messages: Array.from({ length: args.messageCount }, (_, index) => ({
      id: `${args.id}-m${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `${args.id}#${index}`,
      timestamp: 1000 + index
    })),
    pinnedAt: args.pinnedAt ?? null,
    updatedAt: args.updatedAt
  };
}

function createStore() {
  return createTypedChatSqliteStore({ driver: createNodeSqliteDriver() });
}

describe('typed chat SQLite store on a real node:sqlite engine', () => {
  it('reads conversation summaries with real COUNT/MAX aggregation and updated-at ordering', async () => {
    const store = createStore();
    await store.writeConversations([
      conversation({ id: 'older', updatedAt: 100, messageCount: 3 }),
      conversation({ id: 'newer', updatedAt: 200, messageCount: 1 })
    ]);

    const summaries = await store.readConversationSummaries();

    expect(summaries.map((summary) => summary.id)).toEqual(['newer', 'older']);
    const older = summaries.find((summary) => summary.id === 'older');
    expect(older).toEqual(expect.objectContaining({
      messageCount: 3,
      // MAX(message.updated_at): the last message's timestamp is 1000 + (3 - 1).
      latestMessageTimestamp: 1002
    }));
  });

  it('reads durable conversation metadata and a missing conversation as null', async () => {
    const store = createStore();
    await store.writeConversations([conversation({ id: 'c1', updatedAt: 100, messageCount: 2, draft: 'unsent reply' })]);

    expect(await store.readConversationMetadata('c1')).toEqual(expect.objectContaining({
      id: 'c1',
      title: 'Title c1',
      draft: 'unsent reply'
    }));
    expect(await store.readConversationMetadata('missing')).toBeNull();
  });

  it('pages message windows by seq, ending loaded with no further cursor', async () => {
    const store = createStore();
    await store.writeConversations([conversation({ id: 'c1', updatedAt: 100, messageCount: 5 })]);

    const first = await store.readMessageWindow('c1', { limit: 2 });
    expect(first.status).toBe('partial');
    expect(first.expectedCount).toBe(5);
    expect(first.messages.map((message) => message.content)).toEqual(['c1#3', 'c1#4']);
    expect(first.nextBeforeSeq).toBe(3);

    const second = await store.readMessageWindow('c1', { limit: 2, beforeSeq: first.nextBeforeSeq! });
    expect(second.status).toBe('partial');
    expect(second.messages.map((message) => message.content)).toEqual(['c1#1', 'c1#2']);
    expect(second.nextBeforeSeq).toBe(1);

    const third = await store.readMessageWindow('c1', { limit: 2, beforeSeq: second.nextBeforeSeq! });
    expect(third.status).toBe('loaded');
    expect(third.messages.map((message) => message.content)).toEqual(['c1#0']);
    expect(third.nextBeforeSeq).toBeNull();
  });

  it('returns a full window as loaded with all messages in chronological order', async () => {
    const store = createStore();
    await store.writeConversations([conversation({ id: 'c1', updatedAt: 100, messageCount: 3 })]);

    const window = await store.readMessageWindow('c1', { limit: 10 });

    expect(window.status).toBe('loaded');
    expect(window.expectedCount).toBe(3);
    expect(window.messages.map((message) => message.content)).toEqual(['c1#0', 'c1#1', 'c1#2']);
    expect(window.nextBeforeSeq).toBeNull();
  });

  it('distinguishes a missing conversation from a loaded empty one', async () => {
    const store = createStore();
    await store.writeConversations([conversation({ id: 'empty', updatedAt: 100, messageCount: 0 })]);

    expect(await store.readMessageWindow('missing', { limit: 10 })).toEqual(expect.objectContaining({
      status: 'missing',
      messages: [],
      expectedCount: 0
    }));
    expect(await store.readMessageWindow('empty', { limit: 10 })).toEqual(expect.objectContaining({
      status: 'loaded',
      messages: [],
      expectedCount: 0,
      nextBeforeSeq: null
    }));
  });

  it('replaces only the rewritten conversation message rows', async () => {
    const store = createStore();
    await store.writeConversations([
      conversation({ id: 'a', updatedAt: 100, messageCount: 3 }),
      conversation({ id: 'b', updatedAt: 100, messageCount: 2 })
    ]);

    await store.writeConversations([conversation({ id: 'a', updatedAt: 150, messageCount: 1 })]);

    const a = await store.readMessageWindow('a', { limit: 10 });
    const b = await store.readMessageWindow('b', { limit: 10 });
    expect(a.messages.map((message) => message.content)).toEqual(['a#0']);
    expect(b.messages.map((message) => message.content)).toEqual(['b#0', 'b#1']);
  });
});
