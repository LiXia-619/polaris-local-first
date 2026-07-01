import type { Conversation, PolarisTriggerTarget } from '../../types/domain';

type TriggerConversationResolutionState = {
  conversations: Conversation[];
  activeConversationId: string | null;
};

type TriggerConversationResolutionWriter = {
  createConversation: (collaboratorId?: string | null) => string;
  getConversations: () => Conversation[];
};

function isOrdinaryConversationForCollaborator(
  conversation: Pick<Conversation, 'collaboratorId' | 'activeProjectId'>,
  collaboratorId: string
) {
  return conversation.collaboratorId === collaboratorId
    && (conversation.activeProjectId ?? null) === null;
}

export function resolveTriggerConversationForTarget(
  target: PolarisTriggerTarget,
  state: TriggerConversationResolutionState,
  writer: TriggerConversationResolutionWriter
) {
  if (target.conversationMode === 'fixed' && target.conversationId) {
    const fixedConversation = state.conversations.find(
      (conversation) =>
        conversation.id === target.conversationId
        && conversation.collaboratorId === target.collaboratorId
    ) ?? null;
    if (fixedConversation) return fixedConversation;
  }

  const activeConversation = state.activeConversationId
    ? state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? null
    : null;
  if (activeConversation && isOrdinaryConversationForCollaborator(activeConversation, target.collaboratorId)) {
    return activeConversation;
  }

  const latestOrdinaryConversation = state.conversations.find((conversation) =>
    isOrdinaryConversationForCollaborator(conversation, target.collaboratorId)
  ) ?? null;
  if (latestOrdinaryConversation) return latestOrdinaryConversation;

  const conversationId = writer.createConversation(target.collaboratorId);
  return writer.getConversations().find((conversation) => conversation.id === conversationId)
    ?? null;
}
