import { describe, expect, it } from 'vitest';
import {
  mergeRequestSemanticRecallConversations,
  selectRequestSemanticRecallConversationIds
} from './chatSemanticRecallCorpus';
import type { Conversation } from '../../types/domain';

function conversation(id: string, messages: Conversation['messages']): Conversation {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    activeProjectId: null,
    draft: '',
    pinnedAt: null,
    updatedAt: 1,
    messages
  };
}

describe('mergeRequestSemanticRecallConversations', () => {
  it('keeps persisted inactive bodies while overlaying the active live conversation', () => {
    const result = mergeRequestSemanticRecallConversations({
      persistedConversations: [
        conversation('active', [{
          id: 'persisted-active-user',
          role: 'user',
          content: 'old active persisted body',
          timestamp: 1
        }]),
        conversation('old', [{
          id: 'old-user',
          role: 'user',
          content: 'stable persisted old body',
          timestamp: 1
        }])
      ],
      liveConversations: [
        conversation('active', []),
        conversation('old', [])
      ],
      activeConversationId: 'active',
      activeMessages: [{
        id: 'live-active-user',
        role: 'user',
        content: 'fresh active request body',
        timestamp: 2
      }]
    });

    expect(result.find((entry) => entry.id === 'active')?.messages).toEqual([
      expect.objectContaining({
        id: 'live-active-user',
        content: 'fresh active request body'
      })
    ]);
    expect(result.find((entry) => entry.id === 'old')?.messages).toEqual([
      expect.objectContaining({
        id: 'old-user',
        content: 'stable persisted old body'
      })
    ]);
  });

  it('selects only configured recent same-collaborator bodies for request-time recall', () => {
    const result = selectRequestSemanticRecallConversationIds({
      conversations: [
        { ...conversation('active', []), updatedAt: 5 },
        { ...conversation('recent-a', []), updatedAt: 4 },
        { ...conversation('recent-b', []), updatedAt: 3 },
        { ...conversation('other-collaborator', []), collaboratorId: 'nova', updatedAt: 2 },
        { ...conversation('older', []), updatedAt: 1 }
      ],
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      config: {
        recentTailConversationCount: 1,
        voiceAnchorCount: 2
      }
    });

    expect(result).toEqual(['recent-a', 'recent-b']);
  });
});
