import { describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../types/domain';
import {
  createDirectConversationRecord,
  createGroupConversationRecord,
  orphanConversationInRecords,
  orphanConversationRecord,
  renameConversationInRecords,
  renameConversationRecord,
  toggleConversationPinnedInRecords,
  toggleConversationPinnedRecord,
  touchConversationInRecords,
  touchConversationRecord,
  updateGroupConversationInRecords,
  updateGroupConversationRecord
} from './chatConversationRecords';

function directConversation(patch: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c-1',
    title: '新对话',
    kind: 'direct',
    collaboratorId: 'pharos',
    groupRoomId: null,
    activeProjectId: null,
    messages: [],
    pinnedAt: null,
    updatedAt: 1,
    ...patch
  };
}

describe('chat conversation records', () => {
  it('creates direct conversations with explicit ownership and project binding', () => {
    vi.setSystemTime(1234);

    expect(createDirectConversationRecord({
      collaboratorId: 'pharos',
      activeProjectId: 'workspace-1'
    })).toEqual(expect.objectContaining({
      title: '新对话',
      kind: 'direct',
      collaboratorId: 'pharos',
      activeProjectId: 'workspace-1',
      groupRoomId: null,
      draft: '',
      pinnedAt: null,
      updatedAt: 1234,
      messages: []
    }));

    vi.useRealTimers();
  });

  it('creates group conversations with normalized members and default tool settings', () => {
    const conversation = createGroupConversationRecord({
      title: ' 工作群 ',
      memberIds: ['pharos', 'lyra', 'pharos', ' '],
      lineageId: 'lineage-1'
    });

    expect(conversation).toEqual(expect.objectContaining({
      title: '工作群',
      kind: 'group',
      collaboratorId: null,
      groupRoomId: null
    }));
    expect(conversation.group).toEqual(expect.objectContaining({
      title: '工作群',
      memberIds: ['pharos', 'lyra'],
      lineageId: 'lineage-1',
      replyMode: 'round',
      memoryRecallEnabled: true,
      toolSettings: {
        cards: false,
        images: false,
        attachments: false,
        web: false,
        mcp: false
      }
    }));
  });

  it('updates only real group conversations and merges group tool settings', () => {
    const groupConversation = createGroupConversationRecord({
      memberIds: ['pharos']
    });
    const updated = updateGroupConversationRecord(groupConversation, {
      title: '新群名',
      memberIds: ['lyra', 'lyra'],
      toolSettings: {
        cards: false,
        images: true,
        attachments: false,
        web: false,
        mcp: false
      }
    });

    expect(updateGroupConversationRecord(directConversation(), { title: '不会生效' })).toBeNull();
    expect(updated).toEqual(expect.objectContaining({
      title: '新群名'
    }));
    expect(updated?.group).toEqual(expect.objectContaining({
      title: '新群名',
      memberIds: ['lyra'],
      toolSettings: {
        cards: false,
        images: true,
        attachments: false,
        web: false,
        mcp: false
      }
    }));
  });

  it('applies small conversation metadata transforms immutably', () => {
    vi.setSystemTime(2345);

    const base = directConversation();

    expect(touchConversationRecord(base)).toEqual(expect.objectContaining({
      updatedAt: 2345
    }));
    expect(renameConversationRecord(base, '新标题')).toEqual(expect.objectContaining({
      title: '新标题',
      updatedAt: 2345
    }));
    expect(toggleConversationPinnedRecord(base)).toEqual(expect.objectContaining({
      pinnedAt: 2345
    }));
    expect(orphanConversationRecord(base)).toEqual(expect.objectContaining({
      collaboratorId: null,
      updatedAt: 1
    }));
    expect(base).toEqual(expect.objectContaining({
      title: '新对话',
      collaboratorId: 'pharos',
      pinnedAt: null,
      updatedAt: 1
    }));

    vi.useRealTimers();
  });

  it('updates a matching group conversation inside a record list', () => {
    const direct = directConversation({ id: 'c-direct' });
    const group = createGroupConversationRecord({
      title: '旧群',
      memberIds: ['pharos'],
      lineageId: 'lineage-1'
    });

    const updated = updateGroupConversationInRecords([direct, group], group.id, {
      title: '新群',
      memberIds: ['lyra', 'lyra']
    });

    expect(updateGroupConversationInRecords([direct], direct.id, { title: '不会生效' })).toBeNull();
    expect(updated?.[0]).toBe(direct);
    expect(updated?.[1]).toEqual(expect.objectContaining({
      id: group.id,
      title: '新群'
    }));
    expect(updated?.[1]?.group).toEqual(expect.objectContaining({
      title: '新群',
      memberIds: ['lyra']
    }));
  });

  it('applies matching metadata transforms inside a record list', () => {
    vi.setSystemTime(3456);

    const first = directConversation({ id: 'c-1' });
    const second = directConversation({ id: 'c-2', title: 'Second', pinnedAt: null });
    const conversations = [first, second];

    expect(touchConversationInRecords(conversations, 'c-2')).toEqual([
      first,
      expect.objectContaining({ id: 'c-2', updatedAt: 3456 })
    ]);
    expect(renameConversationInRecords(conversations, 'c-2', '  Renamed  ')).toEqual([
      first,
      expect.objectContaining({ id: 'c-2', title: 'Renamed', updatedAt: 3456 })
    ]);
    expect(renameConversationInRecords(conversations, 'c-2', '   ')).toBeNull();
    expect(toggleConversationPinnedInRecords(conversations, 'c-2')).toEqual([
      first,
      expect.objectContaining({ id: 'c-2', pinnedAt: 3456 })
    ]);
    expect(orphanConversationInRecords(conversations, 'c-1')).toEqual([
      expect.objectContaining({ id: 'c-1', collaboratorId: null, updatedAt: 1 }),
      second
    ]);

    expect(first).toEqual(expect.objectContaining({
      collaboratorId: 'pharos',
      updatedAt: 1
    }));

    vi.useRealTimers();
  });
});
