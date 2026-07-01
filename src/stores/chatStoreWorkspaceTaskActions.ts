import type { RuntimeFeedbackEvent } from '../engines/runtime-feedback/runtimeFeedbackEvents';
import type { PendingWorkspaceProposalRecord } from '../engines/workspaceBinding';
import { sortConversations } from './chatCurrentPersistence';
import {
  applySeededConversationTask,
  getConversationTaskFromRecords,
  resolveConversationTaskForConversation,
  setConversationTaskOnRecords
} from './chatConversationTasks';
import {
  appendRuntimeFeedbackEventToState,
  getRuntimeFeedbackEventsForConversation,
  reconcileConversationWorkspaceBindings,
  removePendingWorkspaceProposal,
  setConversationWorkspaceProject,
  upsertPendingWorkspaceProposal
} from './chatWorkspaceFeedback';
import {
  markConversationDirty,
  markConversationsDirty
} from './chatPersistenceMarkers';
import type { ChatState, ChatStoreGet, ChatStoreSet } from './chatStoreTypes';

type ChatWorkspaceTaskActions = Pick<
  ChatState,
  | 'setConversationActiveProject'
  | 'reconcileConversationWorkspaceBindings'
  | 'upsertPendingWorkspaceProposal'
  | 'removePendingWorkspaceProposal'
  | 'appendRuntimeFeedbackEvent'
  | 'getRuntimeFeedbackEvents'
  | 'getWorkspaceScopeEvents'
  | 'getConversationTask'
  | 'ensureConversationTask'
  | 'setConversationTask'
>;

export function createChatWorkspaceTaskActions(
  set: ChatStoreSet,
  get: ChatStoreGet
): ChatWorkspaceTaskActions {
  return {
    setConversationActiveProject: (conversationId, projectId) => {
      set((state) => {
        const result = setConversationWorkspaceProject(state, conversationId, projectId);
        if (!result) return state;
        return {
          conversations: sortConversations(result.conversations),
          workspaceScopeEventsByConversationId: result.workspaceScopeEventsByConversationId,
          ...markConversationDirty(state, result.dirtyConversationId)
        };
      });
    },

    reconcileConversationWorkspaceBindings: (validProjectIds) => {
      set((state) => {
        const result = reconcileConversationWorkspaceBindings(state.conversations, validProjectIds);
        if (!result) return state;
        return {
          conversations: result.conversations,
          ...markConversationsDirty(state, result.dirtyConversationIds)
        };
      });
    },

    upsertPendingWorkspaceProposal: (proposal: PendingWorkspaceProposalRecord) => {
      set((state) => ({
        pendingWorkspaceProposals: upsertPendingWorkspaceProposal(state.pendingWorkspaceProposals, proposal)
      }));
    },

    removePendingWorkspaceProposal: (proposalId) => {
      set((state) => ({
        pendingWorkspaceProposals: removePendingWorkspaceProposal(state.pendingWorkspaceProposals, proposalId)
      }));
    },

    appendRuntimeFeedbackEvent: (conversationId, event: RuntimeFeedbackEvent) => {
      set((state) => {
        const result = appendRuntimeFeedbackEventToState(state, conversationId, event);
        return {
          conversations: result.dirtyConversationId
            ? sortConversations(result.conversations)
            : result.conversations,
          transientRuntimeFeedbackEventsByConversationId: result.transientRuntimeFeedbackEventsByConversationId,
          ...(result.dirtyConversationId ? markConversationDirty(state, result.dirtyConversationId) : {})
        };
      });
    },

    getRuntimeFeedbackEvents: (conversationId) => {
      const state = get();
      return getRuntimeFeedbackEventsForConversation(
        state.conversations,
        state.transientRuntimeFeedbackEventsByConversationId,
        conversationId
      );
    },

    getWorkspaceScopeEvents: (conversationId) => get().workspaceScopeEventsByConversationId[conversationId] ?? [],

    getConversationTask: (conversationId) =>
      getConversationTaskFromRecords(get().conversations, conversationId),

    ensureConversationTask: (conversationId, messages, options) => {
      const resolved = resolveConversationTaskForConversation({
        conversations: get().conversations,
        conversationId,
        messages,
        mode: options?.mode
      });
      if (!resolved.shouldPersist) return resolved.task;
      const nextTask = resolved.task;
      if (!nextTask) return null;

      set((state) => ({
        conversations: sortConversations(
          applySeededConversationTask({
            conversations: state.conversations,
            conversationId,
            task: nextTask,
            updatedAt: Date.now()
          })
        ),
        ...markConversationDirty(state, conversationId)
      }));
      return nextTask;
    },

    setConversationTask: (conversationId, task) => {
      set((state) => ({
        conversations: sortConversations(
          setConversationTaskOnRecords({
            conversations: state.conversations,
            conversationId,
            task
          })
        ),
        ...markConversationDirty(state, conversationId)
      }));
    }
  };
}
