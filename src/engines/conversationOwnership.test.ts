import { describe, expect, it } from 'vitest';
import {
  conversationMatchesCollaboratorScope,
  isConversationOrphaned,
  resolveConversationCollaboratorId,
  resolveConversationCollaboratorName
} from './conversationOwnership';

describe('conversationOwnership', () => {
  it('resolves collaborator id from the conversation', () => {
    expect(resolveConversationCollaboratorId({ collaboratorId: 'lyra' })).toBe('lyra');
  });

  it('treats null collaborator ids as orphaned history', () => {
    expect(resolveConversationCollaboratorId({ collaboratorId: null })).toBeNull();
    expect(isConversationOrphaned({ collaboratorId: null })).toBe(true);
  });

  it('resolves collaborator name from known personas', () => {
    expect(resolveConversationCollaboratorName(
      { collaboratorId: 'lyra' },
      [{ id: 'lyra', name: 'Lyra' }] as never[]
    )).toBe('Lyra');
  });

  it('labels missing collaborators as orphaned history', () => {
    expect(resolveConversationCollaboratorName(
      { collaboratorId: 'unknown' },
      [] as never[]
    )).toBe('未归属历史');
  });

  it('renders orphaned history with a dedicated label', () => {
    expect(resolveConversationCollaboratorName(
      { collaboratorId: null },
      [] as never[]
    )).toBe('未归属历史');
  });

  it('keeps owned conversations scoped to their collaborator', () => {
    expect(conversationMatchesCollaboratorScope({ collaboratorId: 'nova' }, 'nova')).toBe(true);
    expect(conversationMatchesCollaboratorScope({ collaboratorId: 'lyra' }, 'nova')).toBe(false);
  });

  it('keeps orphaned histories out of concrete collaborator scopes', () => {
    expect(conversationMatchesCollaboratorScope({ collaboratorId: null }, 'nova')).toBe(false);
  });

  it('keeps histories with missing collaborators out of concrete collaborator scopes', () => {
    expect(conversationMatchesCollaboratorScope({ collaboratorId: 'missing' }, 'nova', ['nova'])).toBe(false);
    expect(isConversationOrphaned({ collaboratorId: 'missing' }, ['nova'])).toBe(true);
  });

  it('shows every conversation in the unscoped total list', () => {
    expect(conversationMatchesCollaboratorScope({ collaboratorId: 'nova' }, null)).toBe(true);
    expect(conversationMatchesCollaboratorScope({ collaboratorId: null }, null)).toBe(true);
  });

  it('keeps group conversations out of collaborator scopes and aggregate room lists', () => {
    expect(conversationMatchesCollaboratorScope({ collaboratorId: null, groupRoomId: 'group-1' }, null)).toBe(false);
    expect(conversationMatchesCollaboratorScope({ collaboratorId: 'nova', groupRoomId: 'group-1' }, 'nova')).toBe(false);
  });
});
