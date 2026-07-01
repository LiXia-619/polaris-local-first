import { describe, expect, it } from 'vitest';
import type { Conversation } from '../types/domain';
import type { PersistedChatState } from './chatCurrentPersistence';
import { projectHydratedChatStorePatch } from './chatStoreHydration';

function conversation(id: string, patch: Partial<Conversation> = {}): Conversation {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    messages: [],
    pinnedAt: null,
    updatedAt: 1,
    ...patch
  };
}

describe('projectHydratedChatStorePatch', () => {
  it('projects an empty readable payload into a hydrated empty chat state', () => {
    expect(projectHydratedChatStorePatch(null)).toEqual(expect.objectContaining({
      conversations: [],
      activeConversationId: null,
      conversationBodyStatuses: {},
      loadedMessageConversationIds: [],
      loadingMessageConversationIds: [],
      inputDraft: '',
      pendingWorkspaceProposals: [],
      transientRuntimeFeedbackEventsByConversationId: {},
      workspaceScopeEventsByConversationId: {},
      dirtyConversationIds: [],
      deletedConversationIds: [],
      conversationPersistVersion: 0,
      hydrated: true
    }));
  });

  it('drops archive lifecycle rows and keeps only loaded ids that still belong to live conversations', () => {
    const liveConversation = conversation('c-live', { draft: 'live draft' });
    const archivedConversation = conversation('c-archive', { draft: 'old draft' });
    const payload: PersistedChatState = {
      conversations: [liveConversation, archivedConversation],
      activeConversationId: archivedConversation.id,
      loadedConversationIds: [liveConversation.id, archivedConversation.id, 'missing'],
      legacyLifecycleByConversationId: {
        [archivedConversation.id]: { state: 'archive', reason: null }
      }
    };

    expect(projectHydratedChatStorePatch(payload)).toEqual(expect.objectContaining({
      conversations: [liveConversation],
      activeConversationId: liveConversation.id,
      loadedMessageConversationIds: [liveConversation.id],
      inputDraft: liveConversation.draft
    }));
  });

  it('hydrates body statuses and workspace scope events for live conversations', () => {
    const liveConversation = conversation('c-live', {
      workspaceLedger: [{
        id: 'ledger-1',
        kind: 'workspace_scope_changed',
        createdAt: 10,
        change: 'entered',
        previousProjectId: null,
        nextProjectId: 'workspace-1',
        summary: 'entered workspace'
      }]
    });
    const patch = projectHydratedChatStorePatch({
      conversations: [liveConversation],
      activeConversationId: liveConversation.id,
      loadedConversationIds: [liveConversation.id]
    });

    expect(patch.conversationBodyStatuses[liveConversation.id]).toEqual(expect.objectContaining({
      state: 'loaded'
    }));
    expect(patch.workspaceScopeEventsByConversationId).toEqual({
      [liveConversation.id]: [expect.objectContaining({
        conversationId: liveConversation.id,
        kind: 'entered',
        nextProjectId: 'workspace-1'
      })]
    });
  });

  it('rejects a missing active pointer that is not explained by lifecycle rows', () => {
    expect(() => projectHydratedChatStorePatch({
      conversations: [conversation('c-live')],
      activeConversationId: 'c-missing',
      loadedConversationIds: ['c-live'],
      legacyLifecycleByConversationId: {}
    })).toThrow('Active chat state points at a missing conversation: c-missing');
  });
});
