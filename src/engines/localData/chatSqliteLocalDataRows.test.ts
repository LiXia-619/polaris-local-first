import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types/domain';
import {
  buildChatMigrationValidationReportFromRows,
  hydrateChatMigrationConversations
} from './chatMigrationHydration';
import { readTypedChatSqliteLocalDataHydration } from './chatSqliteLocalDataRows';
import type {
  TypedChatSqliteConversationMetadata,
  TypedChatSqliteConversationSummary,
  TypedChatSqliteMessageWindow,
  TypedChatSqliteStore
} from './chatSqliteStore';
import type { CommitPointerRow } from './types';

const pointer: CommitPointerRow = {
  domain: 'chat',
  version: 3,
  committedAt: 30,
  commitId: 'typed-chat-sqlite'
};

function message(id: string, timestamp: number): ChatMessage {
  return {
    id,
    role: 'user',
    content: id,
    timestamp
  };
}

function summary(id: string, messages: ChatMessage[]): TypedChatSqliteConversationSummary {
  return {
    id,
    title: id,
    kind: 'direct',
    collaboratorId: 'pharos',
    groupRoomId: null,
    activeProjectId: 'project-1',
    pinnedAt: null,
    createdAt: 10,
    updatedAt: 30,
    messageCount: messages.length,
    latestMessageTimestamp: Math.max(0, ...messages.map((item) => item.timestamp))
  };
}

function metadata(id: string): TypedChatSqliteConversationMetadata {
  return {
    id,
    title: id,
    kind: 'direct',
    collaboratorId: 'pharos',
    activeProjectId: 'project-1',
    task: {
      id: 'task-1',
      sourceMessageId: 'm-1',
      goal: 'hydrate from typed sqlite',
      title: 'Typed SQLite',
      status: 'running',
      stage: 'proof',
      steps: [],
      executions: [],
      createdAt: 10,
      updatedAt: 20
    },
    draft: 'draft survives',
    workspaceLedger: [{
      id: 'ledger-1',
      kind: 'workspace_scope_changed',
      createdAt: 12,
      change: 'entered',
      previousProjectId: null,
      nextProjectId: 'project-1',
      summary: 'Entered project'
    }],
    pinnedAt: null,
    updatedAt: 30
  };
}

function createStore(args: {
  summaries: TypedChatSqliteConversationSummary[];
  metadataById?: Record<string, TypedChatSqliteConversationMetadata | null>;
  windowById?: Record<string, TypedChatSqliteMessageWindow>;
}): Pick<
  TypedChatSqliteStore,
  'readConversationSummaries' | 'readConversationMetadata' | 'readMessageWindow'
> {
  return {
    async readConversationSummaries() {
      return args.summaries;
    },

    async readConversationMetadata(conversationId) {
      return args.metadataById?.[conversationId] ?? null;
    },

    async readMessageWindow(conversationId) {
      const window = args.windowById?.[conversationId];
      if (!window) {
        return {
          status: 'missing',
          messages: [],
          expectedCount: 0,
          nextBeforeSeq: null
        };
      }
      return window;
    }
  };
}

describe('readTypedChatSqliteLocalDataHydration', () => {
  it('projects complete typed chat SQLite rows into LocalData chat hydration rows', async () => {
    const messages = [message('m-1', 10), message('m-2', 20)];
    const result = await readTypedChatSqliteLocalDataHydration({
      store: createStore({
        summaries: [summary('c-1', messages)],
        metadataById: { 'c-1': metadata('c-1') },
        windowById: {
          'c-1': {
            status: 'loaded',
            messages,
            expectedCount: 2,
            nextBeforeSeq: null
          }
        }
      }),
      activeConversationId: 'c-1',
      version: pointer.version,
      committedAt: pointer.committedAt,
      readAt: 40,
      messageWindowLimit: 50
    });

    expect(result.domainMeta).toEqual(expect.objectContaining({
      status: 'complete',
      value: expect.objectContaining({
        activeConversationId: 'c-1',
        activeConversationCount: 1,
        quarantinedConversationCount: 0,
        totalConversationCount: 1
      })
    }));
    expect(result.rows[0].record).toEqual(expect.objectContaining({
      status: 'complete',
      value: expect.objectContaining({
        id: 'c-1',
        draft: 'draft survives',
        workspaceLedger: [expect.objectContaining({ id: 'ledger-1' })],
        task: expect.objectContaining({ id: 'task-1' }),
        messages
      })
    }));
    expect(hydrateChatMigrationConversations(result.rows)).toEqual([
      expect.objectContaining({
        state: 'active',
        catalog: expect.objectContaining({ id: 'c-1' }),
        record: expect.objectContaining({ id: 'c-1' })
      })
    ]);
  });

  it('projects partial message windows as incomplete records instead of complete empty rows', async () => {
    const messages = [message('m-1', 10), message('m-2', 20), message('m-3', 30)];
    const partialMessages = messages.slice(1);
    const result = await readTypedChatSqliteLocalDataHydration({
      store: createStore({
        summaries: [summary('c-partial', messages)],
        metadataById: { 'c-partial': metadata('c-partial') },
        windowById: {
          'c-partial': {
            status: 'partial',
            messages: partialMessages,
            expectedCount: 3,
            nextBeforeSeq: 1
          }
        }
      }),
      activeConversationId: 'c-partial',
      version: pointer.version,
      committedAt: pointer.committedAt,
      readAt: 40,
      messageWindowLimit: 2
    });

    expect(result.domainMeta).toEqual(expect.objectContaining({
      value: expect.objectContaining({
        activeConversationId: null,
        activeConversationCount: 0,
        quarantinedConversationCount: 1,
        totalConversationCount: 1
      })
    }));
    expect(result.rows[0].record).toEqual(expect.objectContaining({
      status: 'incomplete',
      reason: 'Typed chat SQLite conversation body is partial.'
    }));
    expect(hydrateChatMigrationConversations(result.rows)).toEqual([{
      state: 'quarantined',
      id: 'c-partial',
      reason: 'conversation record is incomplete'
    }]);
  });

  it('does not invent default metadata when the typed conversation metadata is missing', async () => {
    const messages = [message('m-1', 10)];
    const result = await readTypedChatSqliteLocalDataHydration({
      store: createStore({
        summaries: [summary('c-metadata-missing', messages)],
        metadataById: { 'c-metadata-missing': null },
        windowById: {
          'c-metadata-missing': {
            status: 'loaded',
            messages,
            expectedCount: 1,
            nextBeforeSeq: null
          }
        }
      }),
      activeConversationId: 'c-metadata-missing',
      version: pointer.version,
      committedAt: pointer.committedAt,
      readAt: 40,
      messageWindowLimit: 50
    });

    expect(result.rows[0].record).toEqual(expect.objectContaining({
      status: 'incomplete',
      reason: 'Typed chat SQLite conversation metadata is missing.'
    }));
    expect(result.activeConversationIds).toEqual([]);
    expect(result.quarantinedConversationIds).toEqual(['c-metadata-missing']);
  });

  it('builds validation evidence from typed SQLite projections without counting quarantined rows as active', async () => {
    const activeMessages = [message('m-1', 10)];
    const partialMessages = [message('m-2', 20), message('m-3', 30)];
    const result = await readTypedChatSqliteLocalDataHydration({
      store: createStore({
        summaries: [
          summary('c-active', activeMessages),
          summary('c-partial', partialMessages)
        ],
        metadataById: {
          'c-active': metadata('c-active'),
          'c-partial': metadata('c-partial')
        },
        windowById: {
          'c-active': {
            status: 'loaded',
            messages: activeMessages,
            expectedCount: 1,
            nextBeforeSeq: null
          },
          'c-partial': {
            status: 'partial',
            messages: [partialMessages[1]],
            expectedCount: 2,
            nextBeforeSeq: 1
          }
        }
      }),
      activeConversationId: 'c-active',
      version: pointer.version,
      committedAt: pointer.committedAt,
      readAt: 40,
      messageWindowLimit: 1
    });

    const report = buildChatMigrationValidationReportFromRows({
      pointer,
      domainMeta: result.domainMeta,
      legacyBaselineConversationIds: ['c-active', 'c-partial'],
      legacyActiveConversationIds: ['c-active'],
      rows: result.rows,
      validatedAt: 40
    });

    expect(report).toEqual(expect.objectContaining({
      stagingHydrated: true,
      activeObjectCount: 1,
      activeObjectIds: ['c-active'],
      quarantinedObjectCount: 1,
      quarantinedObjectIds: ['c-partial']
    }));
  });
});
