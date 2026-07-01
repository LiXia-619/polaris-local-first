import { describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../types/domain';
import {
  appendWorkspaceLedgerEventToConversations,
  appendRuntimeFeedbackEventToState,
  createWorkspaceScopeLedgerChange,
  getRuntimeFeedbackEventsForConversation,
  hydrateRuntimeFeedbackEventsFromConversation,
  hydrateWorkspaceScopeEvents,
  reconcileConversationWorkspaceBindings,
  removePendingWorkspaceProposal,
  setConversationWorkspaceProject,
  toWorkspaceLedgerEvent,
  upsertPendingWorkspaceProposal
} from './chatWorkspaceFeedback';

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

describe('chat workspace feedback', () => {
  it('creates matching scope and ledger records for workspace binding changes', () => {
    vi.setSystemTime(1234);

    const { scopeEvent, workspaceLedgerEvent } = createWorkspaceScopeLedgerChange({
      conversationId: 'c-1',
      previousProjectId: null,
      nextProjectId: 'workspace-1'
    });

    expect(scopeEvent).toEqual({
      conversationId: 'c-1',
      previousProjectId: null,
      nextProjectId: 'workspace-1',
      kind: 'entered',
      timestamp: 1234
    });
    expect(workspaceLedgerEvent).toEqual(expect.objectContaining({
      kind: 'workspace_scope_changed',
      change: 'entered',
      previousProjectId: null,
      nextProjectId: 'workspace-1',
      createdAt: 1234
    }));

    vi.useRealTimers();
  });

  it('maps persistable runtime feedback into workspace ledger events', () => {
    expect(toWorkspaceLedgerEvent({
      id: 'rtf-1',
      kind: 'workspace_proposal_resolved',
      createdAt: 10,
      proposalId: 'proposal-1',
      decision: 'accepted',
      summary: 'accepted'
    })).toEqual({
      id: 'rtf-1',
      kind: 'workspace_proposal_resolved',
      createdAt: 10,
      proposalId: 'proposal-1',
      decision: 'accepted',
      summary: 'accepted'
    });

    expect(toWorkspaceLedgerEvent({
      id: 'rtf-2',
      kind: 'assistant_tool_preparation_failed',
      createdAt: 11,
      status: 'parse_failed',
      summary: 'failed'
    })).toBeNull();
  });

  it('appends workspace ledger events without changing unrelated conversations', () => {
    const first = conversation('c-1');
    const second = conversation('c-2');
    const next = appendWorkspaceLedgerEventToConversations([first, second], 'c-1', {
      id: 'ledger-1',
      kind: 'workspace_scope_changed',
      createdAt: 10,
      change: 'entered',
      previousProjectId: null,
      nextProjectId: 'workspace-1',
      summary: 'entered'
    });

    expect(next[0]).toEqual(expect.objectContaining({
      id: 'c-1',
      updatedAt: 10,
      workspaceLedger: [expect.objectContaining({ id: 'ledger-1' })]
    }));
    expect(next[1]).toBe(second);
  });

  it('sets workspace binding and records matching scope feedback', () => {
    const base = {
      conversations: [conversation('c-1')],
      workspaceScopeEventsByConversationId: {}
    };

    const result = setConversationWorkspaceProject(base, 'c-1', 'workspace-1');

    expect(result).toEqual(expect.objectContaining({
      dirtyConversationId: 'c-1'
    }));
    expect(result?.conversations[0]).toEqual(expect.objectContaining({
      id: 'c-1',
      activeProjectId: 'workspace-1',
      workspaceLedger: [expect.objectContaining({
        kind: 'workspace_scope_changed',
        change: 'entered'
      })]
    }));
    expect(result?.workspaceScopeEventsByConversationId['c-1']).toEqual([
      expect.objectContaining({
        conversationId: 'c-1',
        nextProjectId: 'workspace-1',
        kind: 'entered'
      })
    ]);
    expect(setConversationWorkspaceProject(result!, 'c-1', 'workspace-1')).toBeNull();
  });

  it('clears stale workspace bindings and reports dirty conversations', () => {
    const result = reconcileConversationWorkspaceBindings([
      conversation('c-stale', { activeProjectId: 'workspace-missing' }),
      conversation('c-live', { activeProjectId: 'workspace-live' }),
      conversation('c-unbound')
    ], ['workspace-live']);

    expect(result?.dirtyConversationIds).toEqual(['c-stale']);
    expect(result?.conversations.find((entry) => entry.id === 'c-stale')).toEqual(expect.objectContaining({
      activeProjectId: null
    }));
    expect(result?.conversations.find((entry) => entry.id === 'c-live')).toEqual(expect.objectContaining({
      activeProjectId: 'workspace-live'
    }));
  });

  it('keeps one pending proposal per conversation', () => {
    const first = {
      id: 'proposal-1',
      conversationId: 'c-1',
      source: 'model-proposed' as const,
      requestedProjectTitle: 'Mini Phone',
      requestedActions: [],
      requestedActionKinds: ['createRoomProject' as const],
      requestedFilePaths: ['index.html'],
      draftProjectId: 'mini-phone',
      status: 'pending' as const,
      createdAt: 1
    };
    const second = {
      ...first,
      id: 'proposal-2',
      requestedProjectTitle: 'Ocean Glass',
      draftProjectId: 'ocean-glass',
      createdAt: 2
    };

    const proposals = upsertPendingWorkspaceProposal(
      upsertPendingWorkspaceProposal([], first),
      second
    );

    expect(proposals).toEqual([expect.objectContaining({ id: 'proposal-2' })]);
    expect(removePendingWorkspaceProposal(proposals, 'proposal-2')).toEqual([]);
  });

  it('routes persistable feedback to the workspace ledger and transient feedback to memory', () => {
    const proposalEvent = {
      id: 'rtf-1',
      kind: 'workspace_proposal_resolved' as const,
      createdAt: 10,
      proposalId: 'proposal-1',
      decision: 'accepted' as const,
      summary: 'accepted'
    };
    const transientEvent = {
      id: 'rtf-2',
      kind: 'assistant_tool_preparation_failed' as const,
      createdAt: 11,
      status: 'parse_failed' as const,
      summary: 'failed'
    };
    const base = {
      conversations: [conversation('c-1')],
      transientRuntimeFeedbackEventsByConversationId: {}
    };

    const persisted = appendRuntimeFeedbackEventToState(base, 'c-1', proposalEvent);
    const transient = appendRuntimeFeedbackEventToState(persisted, 'c-1', transientEvent);

    expect(persisted.dirtyConversationId).toBe('c-1');
    expect(persisted.conversations[0]?.workspaceLedger).toEqual([
      expect.objectContaining({ kind: 'workspace_proposal_resolved' })
    ]);
    expect(transient.dirtyConversationId).toBeNull();
    expect(getRuntimeFeedbackEventsForConversation(
      transient.conversations,
      transient.transientRuntimeFeedbackEventsByConversationId,
      'c-1'
    )).toEqual([
      expect.objectContaining({ kind: 'workspace_proposal_resolved' }),
      expect.objectContaining({ kind: 'assistant_tool_preparation_failed' })
    ]);
  });

  it('hydrates runtime feedback and workspace scope projections from persisted ledger rows', () => {
    const entry = {
      ...conversation('c-1'),
      workspaceLedger: [{
        id: 'ledger-1',
        kind: 'workspace_scope_changed' as const,
        createdAt: 10,
        change: 'switched' as const,
        previousProjectId: 'workspace-1',
        nextProjectId: 'workspace-2',
        summary: 'switched'
      }]
    };

    expect(hydrateRuntimeFeedbackEventsFromConversation(entry)).toEqual([
      expect.objectContaining({
        kind: 'workspace_scope_changed',
        conversationId: 'c-1',
        change: 'switched'
      })
    ]);
    expect(hydrateWorkspaceScopeEvents([entry])).toEqual({
      'c-1': [expect.objectContaining({
        conversationId: 'c-1',
        kind: 'switched'
      })]
    });
  });
});
