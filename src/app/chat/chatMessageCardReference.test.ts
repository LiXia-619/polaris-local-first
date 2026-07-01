import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types/domain';
import {
  findContinueCardReferenceForAssistantMessage,
  findLatestUserContinueCardReference,
  resolveContinuationCodeBlockState
} from './chatMessageCardReference';

describe('findLatestUserContinueCardReference', () => {
  it('only reuses a continue reference from the latest user turn', () => {
    const messages: ChatMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: '继续旧卡',
        timestamp: 1,
        cardReference: {
          id: 'card-1',
          title: '旧卡',
          language: 'html',
          code: '<div>old</div>',
          mode: 'continue'
        }
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '上一轮',
        timestamp: 2
      },
      {
        id: 'user-2',
        role: 'user',
        content: '现在只是聊聊',
        timestamp: 3
      }
    ];

    expect(findLatestUserContinueCardReference(messages)).toBeNull();
  });
});

describe('findContinueCardReferenceForAssistantMessage', () => {
  it('reuses the latest user continue card reference for the following assistant reply', () => {
    const messages: ChatMessage[] = [
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
        id: 'tool-1',
        role: 'system',
        content: '运行中',
        timestamp: 2,
        origin: 'tool-runtime' as const
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '```text\n新内容\n```',
        timestamp: 3
      }
    ];

    expect(findContinueCardReferenceForAssistantMessage(messages, 'assistant-1')).toEqual(
      expect.objectContaining({
        id: 'card-1',
        mode: 'continue'
      })
    );
  });

  it('stops at the previous assistant reply instead of leaking an older turn reference', () => {
    const messages: ChatMessage[] = [
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
        content: '上一轮回答',
        timestamp: 2
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        content: '```text\n新内容\n```',
        timestamp: 3
      }
    ];

    expect(findContinueCardReferenceForAssistantMessage(messages, 'assistant-2')).toBeNull();
  });
});

describe('resolveContinuationCodeBlockState', () => {
  it('marks a continued card as synced when the active target already carries the latest code', () => {
    const messages: ChatMessage[] = [
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

    const result = resolveContinuationCodeBlockState({
      messages,
      assistantMessageId: 'assistant-1',
      cards: [
        {
          id: 'card-1',
          kind: 'room-rule',
          title: '房间规则',
          language: 'text',
          code: '新内容',
          tags: [],
          source: 'manual',
          createdAt: 1,
          updatedAt: 2
        }
      ],
      codeBlocks: [
        {
          blockIndex: 0,
          title: 'text 片段',
          language: 'text',
          code: '新内容',
          tags: []
        }
      ]
    });

    expect(result).toEqual(expect.objectContaining({
      isSynced: true,
      targetCard: expect.objectContaining({ id: 'card-1' })
    }));
  });
});
