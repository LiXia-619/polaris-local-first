import { describe, expect, it, vi } from 'vitest';
import { createChatCodeCardActions } from './chatCodeCardActions';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ChatMessage } from '../../types/domain';

function writableConversation(messages: ChatMessage[] = []): WritableConversationBody {
  return {
    conversationId: 'conv-1',
    conversation: {
      id: 'conv-1',
      title: '测试对话',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages
    },
    messages
  };
}

describe('createChatCodeCardActions', () => {
  it('writes code blocks back into the continued target card instead of saving a new card', async () => {
    const updateCard = vi.fn();
    const setActiveCard = vi.fn();
    const spotlightCard = vi.fn();
    const saveCardFromChat = vi.fn();
    const setCommandStatus = vi.fn();
    const updateMessage = vi.fn();
    const addRuntimeToolMessage = vi.fn();
    const liveMessages: ChatMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: '继续改',
        timestamp: 1,
        cardReference: {
          id: 'card-1',
          title: '房间规则',
          language: 'text',
          code: '旧内容',
          mode: 'continue'
        }
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '```text\n新内容\n```',
        timestamp: 2
      }
    ];

    const actions = createChatCodeCardActions({
      local: {
        setCommandStatus
      },
      chat: {
        ensureConversationWritable: vi.fn(async () => writableConversation(liveMessages)),
        updateMessage
      },
      collection: {
        cards: [
          {
            id: 'card-1',
            kind: 'room-rule',
            title: '房间规则',
            language: 'text',
            code: '旧内容',
            tags: [],
            source: 'manual',
            createdAt: 1,
            updatedAt: 1
          }
        ],
        saveCardFromChat,
        updateCard
      },
      space: {
        setActiveCard,
        spotlightCard,
        setCollectionShelf: vi.fn(),
        setWorld: vi.fn()
      },
      derived: {
        activeConversation: {
          id: 'conv-1',
          collaboratorId: 'pharos',
          messages: []
        },
        activeCollaboratorSourceId: 'pharos',
        codeCardActionModeByMessageId: {
          'assistant-1': 'save'
        }
      },
      frontstageCollaboratorId: 'pharos',
      addRuntimeToolMessage
    });

    await actions.handleCodeCardAction({
      id: 'assistant-1',
      role: 'assistant',
      content: '```text\n新内容\n```',
      timestamp: 2
    });

    expect(updateCard).toHaveBeenCalledWith('card-1', {
      code: '新内容',
      language: 'text'
    });
    expect(setActiveCard).toHaveBeenCalledWith('card-1');
    expect(spotlightCard).toHaveBeenCalledWith('card-1');
    expect(saveCardFromChat).not.toHaveBeenCalled();
    expect(setCommandStatus).toHaveBeenCalledWith('已写回卡片：房间规则');
    expect(addRuntimeToolMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv-1' }), expect.objectContaining({
      kind: 'saveCodeCard',
      cardId: 'card-1'
    }));
  });

  it('updates an existing save-code tool message from the writable conversation body', async () => {
    const updateCard = vi.fn();
    const updateMessage = vi.fn();
    const addRuntimeToolMessage = vi.fn();
    const liveMessages: ChatMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: '继续改',
        timestamp: 1,
        cardReference: {
          id: 'card-1',
          title: '房间规则',
          language: 'text',
          code: '旧内容',
          mode: 'continue'
        }
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '```text\n新内容\n```',
        timestamp: 2
      },
      {
        id: 'tool-1',
        role: 'system',
        content: '已存入卡片',
        timestamp: 3,
        toolInvocation: {
          id: 'tool-save-1',
          kind: 'saveCodeCard',
          status: 'executed',
          title: '已存入卡片',
          summary: '已存入卡片',
          originMessageId: 'assistant-1',
          cardId: 'card-1'
        }
      }
    ];

    const actions = createChatCodeCardActions({
      local: {
        setCommandStatus: vi.fn()
      },
      chat: {
        ensureConversationWritable: vi.fn(async () => writableConversation(liveMessages)),
        updateMessage
      },
      collection: {
        cards: [
          {
            id: 'card-1',
            kind: 'room-rule',
            title: '房间规则',
            language: 'text',
            code: '旧内容',
            tags: [],
            source: 'manual',
            createdAt: 1,
            updatedAt: 1
          }
        ],
        saveCardFromChat: vi.fn(),
        updateCard
      },
      space: {
        setActiveCard: vi.fn(),
        spotlightCard: vi.fn(),
        setCollectionShelf: vi.fn(),
        setWorld: vi.fn()
      },
      derived: {
        activeConversation: {
          id: 'conv-1',
          collaboratorId: 'pharos',
          messages: []
        },
        activeCollaboratorSourceId: 'pharos',
        codeCardActionModeByMessageId: {
          'assistant-1': 'save'
        }
      },
      frontstageCollaboratorId: 'pharos',
      addRuntimeToolMessage
    });

    await actions.handleCodeCardAction({
      id: 'assistant-1',
      role: 'assistant',
      content: '```text\n新内容\n```',
      timestamp: 2
    });

    expect(updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1' }),
      'tool-1',
      expect.objectContaining({
        toolInvocation: expect.objectContaining({
          status: 'saved',
          cardId: 'card-1',
          originMessageId: 'assistant-1'
        })
      })
    );
    expect(addRuntimeToolMessage).not.toHaveBeenCalled();
  });
});
