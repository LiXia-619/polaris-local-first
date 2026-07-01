import { describe, expect, it } from 'vitest';
import { buildChatPresentation } from './chatPresentation';
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

describe('buildChatPresentation', () => {
  it('locks interaction while startup is not ready', () => {
    const presentation = buildChatPresentation({
      activeConversation: conversation('c-1'),
      messages: [],
      conversations: [],
      roomProjects: [],
      persona: null,
      activeCollaboratorId: 'pharos',
      showChatAvatars: true,
      personas: [],
      startupReady: false,
      hasUnsupportedPendingImages: false
    });

    expect(presentation.interactionLocked).toBe(true);
  });

  it('does not lock an empty ready chat surface', () => {
    const presentation = buildChatPresentation({
      activeConversation: conversation('c-1'),
      messages: [],
      conversations: [],
      roomProjects: [],
      persona: null,
      activeCollaboratorId: 'pharos',
      showChatAvatars: true,
      personas: [],
      startupReady: true,
      hasUnsupportedPendingImages: false
    });

    expect(presentation.interactionLocked).toBe(false);
  });
});
