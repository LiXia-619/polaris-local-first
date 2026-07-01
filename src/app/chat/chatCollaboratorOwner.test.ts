import { describe, expect, it } from 'vitest';
import { resolveChatCollaboratorOwnerId } from './chatCollaboratorOwner';

describe('resolveChatCollaboratorOwnerId', () => {
  it('prefers the current frontstage collaborator', () => {
    expect(
      resolveChatCollaboratorOwnerId({
        frontstageCollaboratorId: 'lyra',
        activeConversationCollaboratorId: 'pharos',
        fallbackCollaboratorId: 'aster'
      })
    ).toBe('lyra');
  });

  it('falls back to the active conversation collaborator', () => {
    expect(
      resolveChatCollaboratorOwnerId({
        frontstageCollaboratorId: null,
        activeConversationCollaboratorId: 'pharos',
        fallbackCollaboratorId: 'aster'
      })
    ).toBe('pharos');
  });

  it('can use a conversation lookup when no active conversation is passed in', () => {
    expect(
      resolveChatCollaboratorOwnerId({
        frontstageCollaboratorId: null,
        conversationCollaboratorId: 'aster',
        fallbackCollaboratorId: 'pharos'
      })
    ).toBe('aster');
  });

  it('finally falls back to the active persona', () => {
    expect(
      resolveChatCollaboratorOwnerId({
        frontstageCollaboratorId: null,
        activeConversationCollaboratorId: null,
        fallbackCollaboratorId: 'pharos'
      })
    ).toBe('pharos');
  });
});
