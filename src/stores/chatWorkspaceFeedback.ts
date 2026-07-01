import {
  createWorkspaceScopeChangedFeedbackEvent,
  type RuntimeFeedbackEvent
} from '../engines/runtime-feedback/runtimeFeedbackEvents';
import type { PendingWorkspaceProposalRecord } from '../engines/workspaceBinding';
import type { Conversation, WorkspaceLedgerEvent } from '../types/domain';

export type WorkspaceScopeChangeEvent = {
  conversationId: string;
  previousProjectId: string | null;
  nextProjectId: string | null;
  kind: 'entered' | 'exited' | 'switched';
  timestamp: number;
};

export function toWorkspaceLedgerEvent(event: RuntimeFeedbackEvent): WorkspaceLedgerEvent | null {
  if (event.kind === 'workspace_scope_changed') {
    return {
      id: event.id,
      kind: event.kind,
      createdAt: event.createdAt,
      change: event.change,
      previousProjectId: event.previousProjectId,
      nextProjectId: event.nextProjectId,
      summary: event.summary
    };
  }

  if (event.kind === 'workspace_proposal_resolved') {
    return {
      id: event.id,
      kind: event.kind,
      createdAt: event.createdAt,
      proposalId: event.proposalId,
      decision: event.decision,
      summary: event.summary
    };
  }

  return null;
}

export function appendWorkspaceLedgerEventToConversations(
  conversations: Conversation[],
  conversationId: string,
  event: WorkspaceLedgerEvent
) {
  return conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;

    const nextWorkspaceLedger = [...(conversation.workspaceLedger ?? []), event];
    return {
      ...conversation,
      workspaceLedger: nextWorkspaceLedger,
      updatedAt: Math.max(conversation.updatedAt, event.createdAt)
    };
  });
}

export function hydrateRuntimeFeedbackEventsFromConversation(conversation: Conversation) {
  return (conversation.workspaceLedger ?? []).map<RuntimeFeedbackEvent>((event) =>
    event.kind === 'workspace_scope_changed'
      ? {
          ...event,
          conversationId: conversation.id
        }
      : {
          ...event
        }
  );
}

export function hydrateWorkspaceScopeEvents(conversations: Conversation[]) {
  const entries: Array<[string, WorkspaceScopeChangeEvent[]]> = [];

  for (const conversation of conversations) {
    const events: WorkspaceScopeChangeEvent[] = [];

    for (const event of conversation.workspaceLedger ?? []) {
      if (event.kind !== 'workspace_scope_changed') continue;
      events.push({
        conversationId: conversation.id,
        previousProjectId: event.previousProjectId,
        nextProjectId: event.nextProjectId,
        kind: event.change,
        timestamp: event.createdAt
      });
    }

    if (events.length > 0) {
      entries.push([conversation.id, events]);
    }
  }

  return Object.fromEntries(entries);
}

export function createWorkspaceScopeChangeEvent(args: {
  conversationId: string;
  previousProjectId: string | null;
  nextProjectId: string | null;
}): WorkspaceScopeChangeEvent {
  const { conversationId, previousProjectId, nextProjectId } = args;

  return {
    conversationId,
    previousProjectId,
    nextProjectId,
    kind:
      previousProjectId === null
        ? 'entered'
        : nextProjectId === null
          ? 'exited'
          : 'switched',
    timestamp: Date.now()
  };
}

export function createWorkspaceScopeLedgerChange(args: {
  conversationId: string;
  previousProjectId: string | null;
  nextProjectId: string | null;
}) {
  const scopeEvent = createWorkspaceScopeChangeEvent(args);
  const runtimeFeedbackEvent = createWorkspaceScopeChangedFeedbackEvent({
    conversationId: args.conversationId,
    previousProjectId: args.previousProjectId,
    nextProjectId: args.nextProjectId,
    change: scopeEvent.kind,
    createdAt: scopeEvent.timestamp
  });

  return {
    scopeEvent,
    workspaceLedgerEvent: toWorkspaceLedgerEvent(runtimeFeedbackEvent)!
  };
}

export function appendTransientRuntimeFeedbackEvent(events: RuntimeFeedbackEvent[], nextEvent: RuntimeFeedbackEvent) {
  return [...events, nextEvent];
}

export type WorkspaceBindingState = {
  conversations: Conversation[];
  workspaceScopeEventsByConversationId: Record<string, WorkspaceScopeChangeEvent[]>;
};

export function setConversationWorkspaceProject(
  state: WorkspaceBindingState,
  conversationId: string,
  projectId: string | null
) {
  const targetConversation = state.conversations.find((conversation) => conversation.id === conversationId) ?? null;
  if (!targetConversation) return null;

  const previousProjectId = targetConversation.activeProjectId ?? null;
  if (previousProjectId === projectId) return null;

  const { scopeEvent, workspaceLedgerEvent } = createWorkspaceScopeLedgerChange({
    conversationId,
    previousProjectId,
    nextProjectId: projectId
  });

  return {
    conversations: appendWorkspaceLedgerEventToConversations(
      state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              activeProjectId: projectId,
              updatedAt: scopeEvent.timestamp
            }
          : conversation
      ),
      conversationId,
      workspaceLedgerEvent
    ),
    workspaceScopeEventsByConversationId: {
      ...state.workspaceScopeEventsByConversationId,
      [conversationId]: [
        ...(state.workspaceScopeEventsByConversationId[conversationId] ?? []),
        scopeEvent
      ]
    },
    dirtyConversationId: conversationId
  };
}

export function reconcileConversationWorkspaceBindings(
  conversations: Conversation[],
  validProjectIds: string[]
) {
  const validProjectIdSet = new Set(validProjectIds.map((id) => id.trim()).filter(Boolean));
  const staleConversationIds = conversations
    .filter((conversation) =>
      typeof conversation.activeProjectId === 'string'
      && !validProjectIdSet.has(conversation.activeProjectId)
    )
    .map((conversation) => conversation.id);

  if (staleConversationIds.length === 0) return null;
  const staleConversationIdSet = new Set(staleConversationIds);

  return {
    conversations: conversations.map((conversation) =>
      staleConversationIdSet.has(conversation.id)
        ? { ...conversation, activeProjectId: null }
        : conversation
    ),
    dirtyConversationIds: staleConversationIds
  };
}

export function upsertPendingWorkspaceProposal(
  proposals: PendingWorkspaceProposalRecord[],
  proposal: PendingWorkspaceProposalRecord
) {
  return [
    proposal,
    ...proposals.filter((entry) => entry.conversationId !== proposal.conversationId)
  ];
}

export function removePendingWorkspaceProposal(
  proposals: PendingWorkspaceProposalRecord[],
  proposalId: string
) {
  return proposals.filter((proposal) => proposal.id !== proposalId);
}

export type RuntimeFeedbackState = {
  conversations: Conversation[];
  transientRuntimeFeedbackEventsByConversationId: Record<string, RuntimeFeedbackEvent[]>;
};

export function appendRuntimeFeedbackEventToState(
  state: RuntimeFeedbackState,
  conversationId: string,
  event: RuntimeFeedbackEvent
) {
  const workspaceLedgerEvent = toWorkspaceLedgerEvent(event);
  if (workspaceLedgerEvent) {
    return {
      conversations: appendWorkspaceLedgerEventToConversations(
        state.conversations,
        conversationId,
        workspaceLedgerEvent
      ),
      transientRuntimeFeedbackEventsByConversationId: state.transientRuntimeFeedbackEventsByConversationId,
      dirtyConversationId: conversationId
    };
  }

  return {
    conversations: state.conversations,
    transientRuntimeFeedbackEventsByConversationId: {
      ...state.transientRuntimeFeedbackEventsByConversationId,
      [conversationId]: appendTransientRuntimeFeedbackEvent(
        state.transientRuntimeFeedbackEventsByConversationId[conversationId] ?? [],
        event
      )
    },
    dirtyConversationId: null
  };
}

export function getRuntimeFeedbackEventsForConversation(
  conversations: Conversation[],
  transientRuntimeFeedbackEventsByConversationId: Record<string, RuntimeFeedbackEvent[]>,
  conversationId: string
) {
  const conversation = conversations.find((entry) => entry.id === conversationId) ?? null;
  const persistedEvents = conversation ? hydrateRuntimeFeedbackEventsFromConversation(conversation) : [];
  const transientEvents = transientRuntimeFeedbackEventsByConversationId[conversationId] ?? [];
  return [...persistedEvents, ...transientEvents]
    .sort((left, right) => left.createdAt - right.createdAt);
}
