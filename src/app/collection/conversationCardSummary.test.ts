import { describe, expect, it } from 'vitest';
import { buildConversationCardSummary } from './conversationCardSummary';
import type { Conversation } from '../../types/domain';

function conversation(id: string): Conversation {
  return {
    id,
    title: '旧对话',
    collaboratorId: 'pharos',
    messages: [],
    pinnedAt: null,
    updatedAt: 1
  };
}

describe('buildConversationCardSummary', () => {
  it('localizes the empty excerpt fallback without changing stored messages', () => {
    expect(buildConversationCardSummary(conversation('empty'), { language: 'en-US' }).latestExcerpt)
      .toBe('This chat has no text yet. Open it to continue.');
  });
});
