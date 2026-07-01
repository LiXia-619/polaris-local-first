import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../types/domain';

const localDataMocks = vi.hoisted(() => ({
  readChatStateFromLocalDataLive: vi.fn(async () => null),
  readConversationMessagesFromLocalDataLive: vi.fn(async () => ({ status: 'inactive' as const })),
  writeChatStateToLocalDataRepository: vi.fn(async () => {}),
  writeChatStateToLocalDataRepositoryIfActive: vi.fn(async () => false),
  commitChatConversationRowChangesIfActive: vi.fn(async () => true)
}));

vi.mock('./chat/localData', () => localDataMocks);

import { persistChatStateChange } from './chatCurrentPersistence';

function buildConversation(id: string, messageIds: string[], updatedAt = 1): Conversation {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    activeProjectId: null,
    draft: '',
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

function expectNoSnapshotWrite() {
  expect(localDataMocks.writeChatStateToLocalDataRepositoryIfActive).not.toHaveBeenCalled();
  expect(localDataMocks.writeChatStateToLocalDataRepository).not.toHaveBeenCalled();
}

function rowChanges() {
  const calls = localDataMocks.commitChatConversationRowChangesIfActive.mock.calls as unknown as Array<[{ changes: unknown[] }]>;
  return calls[calls.length - 1]?.[0].changes;
}

describe('persistChatStateChange routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localDataMocks.commitChatConversationRowChangesIfActive.mockResolvedValue(true);
    localDataMocks.writeChatStateToLocalDataRepositoryIfActive.mockResolvedValue(false);
  });

  it('routes a single loaded conversation as one record change, not the snapshot writer', async () => {
    const conversation = buildConversation('conv-a', ['a-1', 'a-2'], 10);

    await persistChatStateChange({
      conversations: [conversation],
      activeConversationId: 'conv-a',
      dirtyConversationIds: ['conv-a'],
      loadedConversationIds: ['conv-a'],
      deletedConversationIds: []
    });

    expect(localDataMocks.commitChatConversationRowChangesIfActive).toHaveBeenCalledWith({
      changes: [{ type: 'upsertRecord', conversation }],
      activeConversationId: 'conv-a'
    });
    expectNoSnapshotWrite();
  });

  it('routes a single unloaded conversation edit as a metadata change', async () => {
    const conversation = buildConversation('conv-a', [], 10);

    await persistChatStateChange({
      conversations: [conversation],
      activeConversationId: 'conv-b',
      dirtyConversationIds: ['conv-a'],
      loadedConversationIds: [],
      deletedConversationIds: []
    });

    expect(rowChanges()).toEqual([{ type: 'upsertMetadata', conversation }]);
    expectNoSnapshotWrite();
  });

  it('routes a single deletion as a delete change', async () => {
    await persistChatStateChange({
      conversations: [buildConversation('conv-a', ['a-1'])],
      activeConversationId: 'conv-a',
      dirtyConversationIds: [],
      loadedConversationIds: ['conv-a'],
      deletedConversationIds: ['conv-b']
    });

    expect(rowChanges()).toEqual([{ type: 'delete', conversationId: 'conv-b' }]);
    expectNoSnapshotWrite();
  });

  it('routes an active-pointer-only change with an empty change set', async () => {
    await persistChatStateChange({
      conversations: [buildConversation('conv-a', ['a-1'])],
      activeConversationId: 'conv-a',
      dirtyConversationIds: [],
      loadedConversationIds: ['conv-a'],
      deletedConversationIds: []
    });

    expect(localDataMocks.commitChatConversationRowChangesIfActive).toHaveBeenCalledWith({
      changes: [],
      activeConversationId: 'conv-a'
    });
    expectNoSnapshotWrite();
  });

  it('routes a multi-conversation batch as one row-change set', async () => {
    const conversationA = buildConversation('conv-a', ['a-1']);
    const conversationB = buildConversation('conv-b', ['b-1']);

    await persistChatStateChange({
      conversations: [conversationA, conversationB],
      activeConversationId: 'conv-a',
      dirtyConversationIds: ['conv-a', 'conv-b'],
      loadedConversationIds: ['conv-a', 'conv-b'],
      deletedConversationIds: ['conv-c']
    });

    expect(rowChanges()).toEqual([
      { type: 'delete', conversationId: 'conv-c' },
      { type: 'upsertRecord', conversation: conversationA },
      { type: 'upsertRecord', conversation: conversationB }
    ]);
    expectNoSnapshotWrite();
  });

  it('turns a dirty retired group shell into a delete change, not an upsert', async () => {
    const retiredGroup: Conversation = {
      ...buildConversation('conv-group', [], 5),
      kind: 'group',
      groupRoomId: 'retired-room'
    };

    await persistChatStateChange({
      conversations: [retiredGroup],
      activeConversationId: 'conv-a',
      dirtyConversationIds: ['conv-group'],
      loadedConversationIds: ['conv-group'],
      deletedConversationIds: []
    });

    expect(rowChanges()).toEqual([{ type: 'delete', conversationId: 'conv-group' }]);
    expectNoSnapshotWrite();
  });

  it('falls back to the snapshot writer when a dirty conversation is missing from the change set', async () => {
    await persistChatStateChange({
      conversations: [buildConversation('conv-a', ['a-1'])],
      activeConversationId: 'conv-a',
      dirtyConversationIds: ['conv-missing'],
      loadedConversationIds: ['conv-missing'],
      deletedConversationIds: []
    });

    expect(localDataMocks.commitChatConversationRowChangesIfActive).not.toHaveBeenCalled();
    expect(localDataMocks.writeChatStateToLocalDataRepositoryIfActive).toHaveBeenCalledTimes(1);
  });

  it('falls back to the snapshot writer when the row writer declines (inactive or unresolvable batch)', async () => {
    localDataMocks.commitChatConversationRowChangesIfActive.mockResolvedValue(false);

    await persistChatStateChange({
      conversations: [buildConversation('conv-a', ['a-1'])],
      activeConversationId: 'conv-a',
      dirtyConversationIds: ['conv-a'],
      loadedConversationIds: ['conv-a'],
      deletedConversationIds: []
    });

    expect(localDataMocks.commitChatConversationRowChangesIfActive).toHaveBeenCalledTimes(1);
    expect(localDataMocks.writeChatStateToLocalDataRepositoryIfActive).toHaveBeenCalledTimes(1);
  });
});
