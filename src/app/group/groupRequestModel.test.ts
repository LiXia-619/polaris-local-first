import { describe, expect, it } from 'vitest';
import {
  buildGroupMemberSystemMessage,
  buildGroupToolPreferences,
  buildLaneDigestMessage,
  GROUP_LANE_TOOL_SETTINGS
} from './groupRequestModel';
import type { ChatMessage, Conversation, GroupConversationPrivateEntry, Persona } from '../../types/domain';

const MEMBER = { id: 'm1', name: 'Monday' } as Persona;

function whisper(overrides: Partial<GroupConversationPrivateEntry>): GroupConversationPrivateEntry {
  return {
    id: 'w1',
    kind: 'user-note',
    author: 'user',
    content: '悄悄话',
    createdAt: 100,
    ...overrides
  };
}

function groupConversation(args: {
  entries: GroupConversationPrivateEntry[];
  messages?: ChatMessage[];
}): Conversation {
  return {
    id: 'g1',
    title: '用户的大沙发',
    kind: 'group',
    messages: args.messages ?? [],
    group: {
      title: '用户的大沙发',
      privateLanes: { [MEMBER.id]: args.entries }
    }
  } as unknown as Conversation;
}

describe('buildGroupToolPreferences', () => {
  const SOURCE = { mcp: true, generation: true, web: true, memory: true, memoryRecall: true, memoryWrite: false } as Parameters<typeof buildGroupToolPreferences>[0];

  it('keeps mcp off unless the group switch is on', () => {
    expect(buildGroupToolPreferences(SOURCE, GROUP_LANE_TOOL_SETTINGS).mcp).toBe(false);
    expect(buildGroupToolPreferences(SOURCE, { ...GROUP_LANE_TOOL_SETTINGS, mcp: true }).mcp).toBe(true);
  });

  it('respects a global mcp opt-out even when the group switch is on', () => {
    expect(buildGroupToolPreferences({ ...SOURCE, mcp: false }, { ...GROUP_LANE_TOOL_SETTINGS, mcp: true }).mcp).toBe(false);
  });
});

describe('buildGroupMemberSystemMessage', () => {
  it('warns about side effects only when the group has mcp enabled', () => {
    const base = {
      title: '工作群',
      memberIds: ['m1'],
      privateLanes: {},
      toolSettings: { ...GROUP_LANE_TOOL_SETTINGS }
    };
    const without = buildGroupMemberSystemMessage({
      conversation: { id: 'g1', title: '工作群', kind: 'group', messages: [], group: base } as unknown as Conversation,
      member: MEMBER,
      members: [MEMBER]
    });
    expect(without.content).not.toContain('外部工具');

    const withMcp = buildGroupMemberSystemMessage({
      conversation: {
        id: 'g1', title: '工作群', kind: 'group', messages: [],
        group: { ...base, toolSettings: { ...GROUP_LANE_TOOL_SETTINGS, mcp: true } }
      } as unknown as Conversation,
      member: MEMBER,
      members: [MEMBER]
    });
    expect(withMcp.content).toContain('外部工具');
    expect(withMcp.content).toContain('不要再执行一遍');
  });
});

describe('buildLaneDigestMessage', () => {
  it('returns null when the lane is empty', () => {
    const conversation = groupConversation({ entries: [] });
    expect(buildLaneDigestMessage({ conversation, member: MEMBER })).toBeNull();
  });

  it('frames the lane as a live one-on-one window, not old history', () => {
    const conversation = groupConversation({ entries: [whisper({})] });
    const digest = buildLaneDigestMessage({ conversation, member: MEMBER });
    expect(digest?.content).toContain('一对一小窗');
    expect(digest?.content).toContain('不是旧对话摘要');
    expect(digest?.content).toContain('Monday');
    expect(digest?.content).toContain('用户的大沙发');
  });

  it('marks whispers said after the member last spoke in the group as fresh', () => {
    const conversation = groupConversation({
      entries: [
        whisper({ id: 'old', content: '上轮之前说的', createdAt: 50 }),
        whisper({ id: 'fresh', content: '刚刚说的', createdAt: 200 })
      ],
      messages: [
        {
          id: 'a1',
          role: 'assistant',
          content: '我上轮说过话',
          timestamp: 120,
          speakerCollaboratorId: MEMBER.id
        } as ChatMessage
      ]
    });
    const digest = buildLaneDigestMessage({ conversation, member: MEMBER });
    expect(digest?.content).toContain('用户：上轮之前说的');
    expect(digest?.content).not.toContain('〔新〕用户：上轮之前说的');
    expect(digest?.content).toContain('〔新〕用户：刚刚说的');
    expect(digest?.content).toContain('标〔新〕的');
  });

  it('treats everything as fresh when the member has not spoken yet', () => {
    const conversation = groupConversation({ entries: [whisper({ createdAt: 10 })] });
    const digest = buildLaneDigestMessage({ conversation, member: MEMBER });
    expect(digest?.content).toContain('〔新〕用户：悄悄话');
  });
});
