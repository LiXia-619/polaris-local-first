import { describe, expect, it } from 'vitest';
import type { Conversation } from '../../types/domain';
import {
  resolveFallbackChatConversationForWorldReturn,
  resolveFreshConversationProjectId,
  shouldInferChatConversationForWorldReturn
} from './useAppShellNavigationActions';

describe('shouldInferChatConversationForWorldReturn', () => {
  it('does not reopen chat when collaborator and workspace already match', () => {
    expect(shouldInferChatConversationForWorldReturn({
      frontstageCollaboratorId: 'lyra',
      preferredProjectId: 'workspace-1',
      activeConversationId: 'conversation-1',
      activeConversationCollaboratorId: 'lyra'
    })).toBe(false);
  });

  it('keeps the active conversation when collection is browsing a different workspace', () => {
    expect(shouldInferChatConversationForWorldReturn({
      frontstageCollaboratorId: 'lyra',
      preferredProjectId: 'workspace-2',
      activeConversationId: 'conversation-1',
      activeConversationCollaboratorId: 'lyra'
    })).toBe(false);
  });

  it('reopens chat when there is no active conversation yet', () => {
    expect(shouldInferChatConversationForWorldReturn({
      frontstageCollaboratorId: 'lyra',
      preferredProjectId: null,
      activeConversationId: null,
      activeConversationCollaboratorId: null
    })).toBe(true);
  });

  it('does not infer a different conversation just because collection is viewing a workspace', () => {
    expect(shouldInferChatConversationForWorldReturn({
      frontstageCollaboratorId: 'lyra',
      preferredProjectId: 'workspace-2',
      activeConversationId: 'conversation-1',
      activeConversationCollaboratorId: 'pharos'
    })).toBe(false);
  });

  it('keeps the active workspace conversation when collaborator scope still matches', () => {
    expect(shouldInferChatConversationForWorldReturn({
      frontstageCollaboratorId: 'lyra',
      preferredProjectId: null,
      activeConversationId: 'conversation-1',
      activeConversationCollaboratorId: 'lyra'
    })).toBe(false);
  });

  it('does nothing when there is no frontstage collaborator', () => {
    expect(shouldInferChatConversationForWorldReturn({
      frontstageCollaboratorId: null,
      preferredProjectId: 'workspace-1',
      activeConversationId: 'conversation-1',
      activeConversationCollaboratorId: 'lyra'
    })).toBe(false);
  });
});

describe('resolveFreshConversationProjectId', () => {
  it('does not inherit the active chat workspace when creating a fresh chat', () => {
    expect(resolveFreshConversationProjectId({
      activeWorld: 'chat',
      preferredProjectId: 'workspace-1'
    })).toBeNull();
  });

  it('keeps the explicit collection workspace when creating from collection', () => {
    expect(resolveFreshConversationProjectId({
      activeWorld: 'collection',
      preferredProjectId: 'workspace-1'
    })).toBe('workspace-1');
  });
});

describe('resolveFallbackChatConversationForWorldReturn', () => {
  const conversations: Conversation[] = [
    {
      id: 'conversation-old',
      title: 'Old chat',
      collaboratorId: 'lyra',
      activeProjectId: null,
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    },
    {
      id: 'conversation-workspace',
      title: 'Workspace chat',
      collaboratorId: 'lyra',
      activeProjectId: 'workspace-1',
      draft: '',
      pinnedAt: null,
      updatedAt: 2,
      messages: []
    },
    {
      id: 'conversation-other-owner',
      title: 'Other owner workspace chat',
      collaboratorId: 'pharos',
      activeProjectId: 'workspace-2',
      draft: '',
      pinnedAt: null,
      updatedAt: 3,
      messages: []
    }
  ];

  it('prefers the active conversation when it already owns the current workspace', () => {
    expect(resolveFallbackChatConversationForWorldReturn({
      conversations,
      preferredProjectId: 'workspace-1',
      frontstageCollaboratorId: 'lyra',
      activeConversationId: 'conversation-workspace'
    })?.id).toBe('conversation-workspace');
  });

  it('finds the workspace conversation even when frontstage collaborator is missing', () => {
    expect(resolveFallbackChatConversationForWorldReturn({
      conversations,
      preferredProjectId: 'workspace-1',
      frontstageCollaboratorId: null,
      activeConversationId: 'conversation-old'
    })?.id).toBe('conversation-workspace');
  });

  it('prefers a collaborator-matched workspace conversation before falling back to any owner', () => {
    expect(resolveFallbackChatConversationForWorldReturn({
      conversations,
      preferredProjectId: 'workspace-2',
      frontstageCollaboratorId: 'pharos',
      activeConversationId: 'conversation-old'
    })?.id).toBe('conversation-other-owner');
  });
});
