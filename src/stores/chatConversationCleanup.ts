import type { RuntimeFeedbackEvent } from '../engines/runtime-feedback/runtimeFeedbackEvents';
import type { PendingWorkspaceProposalRecord } from '../engines/workspaceBinding';
import type { Conversation } from '../types/domain';
import {
  type ChatConversationBodyStatus,
  withoutConversationBodyStatus
} from './chatConversationBodyStatus';
import {
  appendConversationId,
  markChatIndexDirty
} from './chatPersistenceMarkers';
import type { WorkspaceScopeChangeEvent } from './chatWorkspaceFeedback';
import { syncConversationToolLedger } from './chatConversationMessages';

export function clearConversationAttachmentsByAssetIds(args: {
  conversations: Conversation[];
  assetIds: string[];
  clearedAt: number;
  canWriteConversationBody: (conversationId: string) => boolean;
}) {
  const targetAssetIds = new Set(args.assetIds.map((assetId) => assetId.trim()).filter(Boolean));
  if (targetAssetIds.size === 0) return null;

  const dirtyConversationIds: string[] = [];
  const conversations = args.conversations.map((conversation) => {
    if (!args.canWriteConversationBody(conversation.id)) return conversation;
    let didChangeConversation = false;
    const messages = conversation.messages.map((message) => {
      if (!message.attachments?.length) return message;

      let didChangeMessage = false;
      const attachments = message.attachments.map((attachment) => {
        if (!targetAssetIds.has(attachment.assetId) || attachment.clearedAt) return attachment;
        didChangeConversation = true;
        didChangeMessage = true;
        const { textContent: _textContent, ...rest } = attachment;
        return {
          ...rest,
          clearedAt: args.clearedAt
        };
      });

      return didChangeMessage
        ? {
            ...message,
            attachments
          }
        : message;
    });

    if (!didChangeConversation) return conversation;
    dirtyConversationIds.push(conversation.id);
    return syncConversationToolLedger({
      ...conversation,
      messages
    });
  });

  if (dirtyConversationIds.length === 0) return null;
  return {
    conversations,
    dirtyConversationIds
  };
}

export type ChatConversationDeletionState = {
  conversations: Conversation[];
  activeConversationId: string | null;
  inputDraft: string;
  conversationBodyStatuses: Record<string, ChatConversationBodyStatus>;
  loadedMessageConversationIds: string[];
  loadingMessageConversationIds: string[];
  dirtyConversationIds: string[];
  deletedConversationIds: string[];
  conversationPersistVersion: number;
  pendingWorkspaceProposals: PendingWorkspaceProposalRecord[];
  transientRuntimeFeedbackEventsByConversationId: Record<string, RuntimeFeedbackEvent[]>;
  workspaceScopeEventsByConversationId: Record<string, WorkspaceScopeChangeEvent[]>;
};

export function deleteConversationFromState(state: ChatConversationDeletionState, conversationId: string) {
  const conversations = state.conversations.filter((conversation) => conversation.id !== conversationId);
  const nextActiveConversationId =
    state.activeConversationId === conversationId ? conversations[0]?.id ?? null : state.activeConversationId;

  return {
    conversations,
    pendingWorkspaceProposals: state.pendingWorkspaceProposals.filter(
      (proposal) => proposal.conversationId !== conversationId
    ),
    transientRuntimeFeedbackEventsByConversationId: Object.fromEntries(
      Object.entries(state.transientRuntimeFeedbackEventsByConversationId)
        .filter(([id]) => id !== conversationId)
    ),
    workspaceScopeEventsByConversationId: Object.fromEntries(
      Object.entries(state.workspaceScopeEventsByConversationId)
        .filter(([id]) => id !== conversationId)
    ),
    activeConversationId: nextActiveConversationId,
    ...withoutConversationBodyStatus(state, conversationId),
    inputDraft:
      state.activeConversationId === conversationId
        ? conversations.find((conversation) => conversation.id === nextActiveConversationId)?.draft ?? ''
        : state.inputDraft,
    dirtyConversationIds: state.dirtyConversationIds.filter((id) => id !== conversationId),
    deletedConversationIds: appendConversationId(state.deletedConversationIds, conversationId),
    ...markChatIndexDirty(state)
  };
}
