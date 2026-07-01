import { describe, expect, it } from 'vitest';
import type { Conversation } from '../../types/domain';
import { selectChatConversations } from './liveConversationCatalog';

describe('selectChatConversations', () => {
  it('keeps group conversations isolated from the normal live catalog by default', () => {
    const conversations = [
      { id: 'conversation-direct', kind: 'direct' },
      { id: 'conversation-group', kind: 'group', group: { title: '群聊', memberIds: [] } }
    ] as Conversation[];

    expect(selectChatConversations(conversations).map((conversation) => conversation.id))
      .toEqual(['conversation-direct']);
    expect(selectChatConversations(
      conversations,
      { includeGroupConversations: true }
    ).map((conversation) => conversation.id)).toEqual([
      'conversation-direct',
      'conversation-group'
    ]);
  });
});
