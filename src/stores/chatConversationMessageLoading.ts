import type { ChatMessage, Conversation } from '../types/domain';
import {
  createBodyStatus,
  getConversationBodyState,
  withConversationBodyStatus,
  type ChatConversationBodyStatus
} from './chatConversationBodyStatus';

type ConversationMessageLoadingState = {
  conversations: Conversation[];
  conversationBodyStatuses: Record<string, ChatConversationBodyStatus>;
  loadedMessageConversationIds: string[];
  loadingMessageConversationIds: string[];
};

type ConversationMessageLoadingPatch = Partial<ConversationMessageLoadingState>;

type ConversationMessageLoadingPort = {
  getState: () => ConversationMessageLoadingState;
  setState: (updater: (state: ConversationMessageLoadingState) => ConversationMessageLoadingPatch) => void;
  readMessages: (conversationId: string) => Promise<ChatMessage[]>;
  applyLoadedMessages: (conversation: Conversation, messages: ChatMessage[]) => Conversation;
};

const chatMessageLoadPromises = new Map<string, Promise<Conversation | null>>();

function isConversationMessageChunkMissingError(error: unknown, conversationId: string) {
  return error instanceof Error
    && error.message === `Conversation message chunk is missing: ${conversationId}`;
}

export async function ensureConversationMessagesLoadedFromState(
  port: ConversationMessageLoadingPort,
  conversationId: string
) {
  const current = port.getState();
  const currentConversation = current.conversations.find((conversation) => conversation.id === conversationId) ?? null;
  if (!currentConversation) return null;
  const currentBodyState = getConversationBodyState(current, conversationId);
  if (currentBodyState === 'loaded') return currentConversation;
  if (currentBodyState === 'missing') {
    throw new Error(`Conversation message chunk is missing: ${conversationId}`);
  }
  const currentBodyStatus = current.conversationBodyStatuses[conversationId];
  if (currentBodyStatus?.state === 'failed') {
    throw new Error(currentBodyStatus.reason);
  }

  const existingPromise = chatMessageLoadPromises.get(conversationId);
  if (existingPromise) return await existingPromise;

  const loadPromise = (async () => {
    port.setState((state) => ({
      ...withConversationBodyStatus(state, conversationId, createBodyStatus('loading'))
    }));
    try {
      const messages = await port.readMessages(conversationId);
      let loadedConversation: Conversation | null = null;
      port.setState((state) => {
        const conversations = state.conversations.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          loadedConversation = port.applyLoadedMessages(conversation, messages);
          return loadedConversation;
        });

        return {
          conversations,
          ...withConversationBodyStatus(state, conversationId, createBodyStatus('loaded'))
        };
      });
      return loadedConversation;
    } catch (error) {
      const status = isConversationMessageChunkMissingError(error, conversationId)
        ? createBodyStatus('missing', { reason: error instanceof Error ? error.message : `Conversation message chunk is missing: ${conversationId}` })
        : createBodyStatus('failed', { reason: error instanceof Error ? error.message : 'Conversation body read failed.' });
      port.setState((state) => withConversationBodyStatus(state, conversationId, status));
      throw error;
    } finally {
      chatMessageLoadPromises.delete(conversationId);
      port.setState((state) => ({
        loadingMessageConversationIds: state.loadingMessageConversationIds.filter((id) => id !== conversationId)
      }));
    }
  })();
  chatMessageLoadPromises.set(conversationId, loadPromise);
  return await loadPromise;
}
