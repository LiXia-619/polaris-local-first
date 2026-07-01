import { describe, expect, it } from 'vitest';
import type { Conversation } from '../../types/domain';
import { buildProactiveReplyNotification, buildReplyPreview } from './proactiveReplyNotification';

function conversation(messages: Conversation['messages']): Conversation {
  return {
    id: 'conversation-1',
    title: '想找你',
    collaboratorId: 'nova',
    messages,
    draft: '',
    pinnedAt: null,
    updatedAt: 1
  };
}

describe('buildReplyPreview', () => {
  it('collapses whitespace and keeps a compact preview', () => {
    expect(buildReplyPreview('  第一行\n\n第二行   还在这里  ')).toBe('第一行 第二行 还在这里');
  });
});

describe('buildProactiveReplyNotification', () => {
  it('returns the latest assistant reply after the trigger message when another conversation is open', () => {
    const result = buildProactiveReplyNotification({
      conversation: conversation([
        { id: 'user-1', role: 'user', content: '早', timestamp: 1 },
        { id: 'trigger-1', role: 'system', content: '主动消息', timestamp: 2 },
        { id: 'assistant-1', role: 'assistant', content: '我写完啦，过来看一眼。', timestamp: 3 }
      ]),
      collaboratorId: 'nova',
      collaboratorName: 'Nova',
      messageCountBeforeReply: 2,
      currentView: {
        activeWorld: 'chat',
        activeConversationId: 'conversation-other'
      }
    });

    expect(result).toEqual({
      kind: 'proactive-reply',
      collaboratorId: 'nova',
      collaboratorName: 'Nova',
      conversationId: 'conversation-1',
      preview: '我写完啦，过来看一眼。'
    });
  });

  it('notifies when the target conversation is already visible', () => {
    const result = buildProactiveReplyNotification({
      conversation: conversation([
        { id: 'trigger-1', role: 'system', content: '主动消息', timestamp: 1 },
        { id: 'assistant-1', role: 'assistant', content: '我在这里。', timestamp: 2 }
      ]),
      collaboratorId: 'nova',
      collaboratorName: 'Nova',
      messageCountBeforeReply: 1,
      currentView: {
        activeWorld: 'chat',
        activeConversationId: 'conversation-1'
      }
    });

    expect(result).toEqual(expect.objectContaining({
      conversationId: 'conversation-1',
      preview: '我在这里。'
    }));
  });

  it('does not notify for old replies that existed before this trigger run', () => {
    const result = buildProactiveReplyNotification({
      conversation: conversation([
        { id: 'assistant-old', role: 'assistant', content: '旧消息', timestamp: 1 },
        { id: 'trigger-1', role: 'system', content: '主动消息', timestamp: 2 }
      ]),
      collaboratorId: 'nova',
      collaboratorName: 'Nova',
      messageCountBeforeReply: 2,
      currentView: {
        activeWorld: 'collection',
        activeConversationId: null
      }
    });

    expect(result).toBeNull();
  });
});
