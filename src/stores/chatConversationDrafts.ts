import type { Conversation } from '../types/domain';

export type ChatConversationDraftState = {
  conversations: Conversation[];
  activeConversationId: string | null;
  inputDraft: string;
};

export type ChatConversationDraftResult = {
  patch: Partial<ChatConversationDraftState>;
  dirtyConversationId: string | null;
};

export function updateActiveConversationDraft(
  state: ChatConversationDraftState,
  value: string
): ChatConversationDraftResult | null {
  if (!state.activeConversationId) {
    if (state.inputDraft === value) return null;
    return {
      patch: { inputDraft: value },
      dirtyConversationId: null
    };
  }

  const activeConversation = state.conversations.find(
    (conversation) => conversation.id === state.activeConversationId
  );
  if (state.inputDraft === value && activeConversation?.draft === value) return null;

  return {
    patch: {
      inputDraft: value,
      conversations: state.conversations.map((conversation) =>
        conversation.id === state.activeConversationId
          ? { ...conversation, draft: value }
          : conversation
      )
    },
    dirtyConversationId: state.activeConversationId
  };
}

export function updateConversationDraft(
  state: ChatConversationDraftState,
  conversationId: string,
  value: string
): ChatConversationDraftResult | null {
  const targetConversation = state.conversations.find((conversation) => conversation.id === conversationId);
  if (!targetConversation) return null;

  const isActiveConversation = state.activeConversationId === conversationId;
  if (targetConversation.draft === value && (!isActiveConversation || state.inputDraft === value)) return null;

  return {
    patch: {
      inputDraft: isActiveConversation ? value : state.inputDraft,
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, draft: value }
          : conversation
      )
    },
    dirtyConversationId: conversationId
  };
}

export function activateConversation(
  state: ChatConversationDraftState,
  conversationId: string
): Partial<Pick<ChatConversationDraftState, 'activeConversationId' | 'inputDraft'>> | null {
  if (state.activeConversationId === conversationId) return null;

  const targetConversation = state.conversations.find((conversation) => conversation.id === conversationId) ?? null;
  return {
    activeConversationId: conversationId,
    inputDraft: targetConversation?.draft ?? ''
  };
}
