import { describe, expect, it, vi } from 'vitest';
import type { PersistedChatState } from './chatCurrentPersistence';
import { evaluateNativeTypedChatSqliteSourceCandidate } from './chatTypedSqliteSourceCandidate';

function state(args: {
  conversations?: PersistedChatState['conversations'];
  activeConversationId?: string | null;
  loadedConversationIds?: string[];
  quarantinedConversationIds?: string[];
} = {}): PersistedChatState {
  return {
    conversations: args.conversations ?? [],
    activeConversationId: args.activeConversationId ?? null,
    activeGroupRoomId: null,
    groupRooms: [],
    loadedConversationIds: args.loadedConversationIds ?? [],
    quarantinedConversationIds: args.quarantinedConversationIds ?? [],
    deletedConversationIds: []
  };
}

describe('evaluateNativeTypedChatSqliteSourceCandidate', () => {
  it('blocks when the native SQLite plugin is unavailable', async () => {
    const readState = vi.fn();

    await expect(evaluateNativeTypedChatSqliteSourceCandidate({
      getPlatform: () => null,
      readState
    })).resolves.toEqual({
      status: 'unavailable',
      platform: null,
      reason: 'native-sqlite-unavailable'
    });
    expect(readState).not.toHaveBeenCalled();
  });

  it('reports an empty typed SQLite source without promoting it to ready', async () => {
    const readState = vi.fn(async () => null);

    await expect(evaluateNativeTypedChatSqliteSourceCandidate({
      getPlatform: () => 'ios',
      readState,
      createStore: () => ({
        readConversationSummaries: vi.fn(),
        readConversationMetadata: vi.fn(),
        readMessageWindow: vi.fn()
      })
    })).resolves.toEqual({
      status: 'empty',
      platform: 'ios',
      reason: 'typed-sqlite-empty'
    });
  });

  it('blocks ready status when typed SQLite hydration quarantines rows', async () => {
    const quarantinedState = state({
      quarantinedConversationIds: ['c-partial']
    });

    await expect(evaluateNativeTypedChatSqliteSourceCandidate({
      getPlatform: () => 'ios',
      readState: vi.fn(async () => quarantinedState),
      createStore: () => ({
        readConversationSummaries: vi.fn(),
        readConversationMetadata: vi.fn(),
        readMessageWindow: vi.fn()
      })
    })).resolves.toEqual({
      status: 'quarantined',
      platform: 'ios',
      reason: 'typed-sqlite-quarantined',
      state: quarantinedState,
      quarantinedConversationIds: ['c-partial']
    });
  });

  it('reports typed SQLite read failures as failed candidate evidence', async () => {
    await expect(evaluateNativeTypedChatSqliteSourceCandidate({
      getPlatform: () => 'ios',
      readState: vi.fn(async () => {
        throw new Error('bad sqlite payload');
      }),
      createStore: () => ({
        readConversationSummaries: vi.fn(),
        readConversationMetadata: vi.fn(),
        readMessageWindow: vi.fn()
      })
    })).resolves.toEqual({
      status: 'failed',
      platform: 'ios',
      reason: 'typed-sqlite-read-failed',
      errorMessage: 'bad sqlite payload'
    });
  });

  it('returns ready only for a native typed SQLite state without quarantine', async () => {
    const readyState = state({
      conversations: [{
        id: 'c-ready',
        title: 'Ready',
        collaboratorId: 'pharos',
        messages: [],
        pinnedAt: null,
        updatedAt: 1
      }],
      activeConversationId: 'c-ready',
      loadedConversationIds: ['c-ready']
    });
    const readState = vi.fn(async () => readyState);

    await expect(evaluateNativeTypedChatSqliteSourceCandidate({
      getPlatform: () => 'ios',
      readState,
      createStore: () => ({
        readConversationSummaries: vi.fn(),
        readConversationMetadata: vi.fn(),
        readMessageWindow: vi.fn()
      }),
      activeConversationId: 'c-ready',
      version: 7,
      committedAt: 11,
      readAt: 12,
      messageWindowLimit: 99
    })).resolves.toEqual({
      status: 'ready',
      platform: 'ios',
      state: readyState,
      activeConversationCount: 1,
      loadedConversationCount: 1
    });
    expect(readState).toHaveBeenCalledWith(expect.objectContaining({
      activeConversationId: 'c-ready',
      version: 7,
      committedAt: 11,
      readAt: 12,
      messageWindowLimit: 99
    }));
  });
});
