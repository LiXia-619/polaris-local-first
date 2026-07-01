import { describe, expect, it, vi } from 'vitest';
import type { WritableConversationBody } from '../../stores/chatStore';
import { createAddRuntimeToolMessage } from './chatToolRuntimeMessages';

function writableConversation(): WritableConversationBody {
  return {
    conversationId: 'conversation-1',
    conversation: {
      id: 'conversation-1',
      title: '测试对话',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    },
    messages: []
  };
}

describe('createAddRuntimeToolMessage', () => {
  it('records completed tool invocations as tool runtime messages only', () => {
    const chat = {
      addMessage: vi.fn(),
      insertMessageAfter: vi.fn(),
      appendRuntimeFeedbackEvent: vi.fn()
    };
    const addRuntimeToolMessage = createAddRuntimeToolMessage(chat as never);

    addRuntimeToolMessage(writableConversation(), {
      id: 'tool-1',
      kind: 'readWebPage',
      status: 'executed',
      title: '读取网页',
      summary: '已读取 https://example.com 。'
    });

    expect(chat.addMessage).toHaveBeenCalledTimes(1);
    expect(chat.appendRuntimeFeedbackEvent).not.toHaveBeenCalled();
  });

  it('does not store a running-state runtime feedback event before the tool settles', () => {
    const chat = {
      addMessage: vi.fn(),
      insertMessageAfter: vi.fn(),
      appendRuntimeFeedbackEvent: vi.fn()
    };
    const addRuntimeToolMessage = createAddRuntimeToolMessage(chat as never);

    addRuntimeToolMessage(writableConversation(), {
      id: 'tool-1',
      kind: 'readWebPage',
      status: 'running',
      title: '读取网页',
      summary: '正在读取 https://example.com 。'
    });

    expect(chat.appendRuntimeFeedbackEvent).not.toHaveBeenCalled();
  });
});
