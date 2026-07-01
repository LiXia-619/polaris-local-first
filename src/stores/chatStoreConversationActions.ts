import { sortConversations } from './chatCurrentPersistence';
import {
  createBodyStatus,
  withConversationBodyStatus
} from './chatConversationBodyStatus';
import {
  activateConversation,
  updateActiveConversationDraft,
  updateConversationDraft
} from './chatConversationDrafts';
import {
  createDirectConversationRecord,
  createGroupConversationRecord,
  orphanConversationInRecords,
  renameConversationInRecords,
  toggleConversationPinnedInRecords,
  touchConversationInRecords,
  updateGroupConversationInRecords
} from './chatConversationRecords';
import {
  markChatIndexDirty,
  markConversationDirty
} from './chatPersistenceMarkers';
import { flushChatPersistenceIfHydrated } from './chatStoreFlush';
import type { ChatState, ChatStoreGet, ChatStoreSet } from './chatStoreTypes';

type ChatConversationActions = Pick<
  ChatState,
  | 'setInputDraft'
  | 'setConversationDraft'
  | 'setActiveConversation'
  | 'createConversation'
  | 'createGroupConversation'
  | 'updateGroupConversation'
  | 'touchConversation'
  | 'renameConversation'
  | 'toggleConversationPinned'
  | 'orphanConversation'
>;

export function createChatConversationActions(
  set: ChatStoreSet,
  get: ChatStoreGet
): ChatConversationActions {
  return {
    setInputDraft: (value) =>
      set((state) => {
        const result = updateActiveConversationDraft(state, value);
        if (!result) return state;
        return {
          ...result.patch,
          ...(result.dirtyConversationId ? markConversationDirty(state, result.dirtyConversationId) : {})
        };
      }),

    setConversationDraft: (conversationId, value) =>
      set((state) => {
        const result = updateConversationDraft(state, conversationId, value);
        if (!result) return state;
        return {
          ...result.patch,
          ...(result.dirtyConversationId ? markConversationDirty(state, result.dirtyConversationId) : {})
        };
      }),

    setActiveConversation: (id) => {
      set((state) => {
        const patch = activateConversation(state, id);
        if (!patch) return state;
        return {
          ...patch,
          ...markChatIndexDirty(state)
        };
      });
      void get().ensureConversationMessagesLoaded(id);
    },

    createConversation: (collaboratorId = null, options) => {
      const next = createDirectConversationRecord({
        collaboratorId,
        activeProjectId: options?.activeProjectId ?? null
      });
      set((state) => ({
        conversations: sortConversations([next, ...state.conversations]),
        activeConversationId: next.id,
        ...withConversationBodyStatus(state, next.id, createBodyStatus('loaded')),
        inputDraft: '',
        ...markConversationDirty(state, next.id)
      }));
      flushChatPersistenceIfHydrated(get, 'create-conversation-flush');
      return next.id;
    },

    createGroupConversation: (options) => {
      const next = createGroupConversationRecord(options);
      set((state) => ({
        conversations: sortConversations([next, ...state.conversations]),
        activeConversationId: next.id,
        ...withConversationBodyStatus(state, next.id, createBodyStatus('loaded')),
        inputDraft: '',
        ...markConversationDirty(state, next.id)
      }));
      flushChatPersistenceIfHydrated(get, 'create-group-conversation-flush');
      return next.id;
    },

    updateGroupConversation: (conversationId, patch) => {
      set((state) => {
        const conversations = updateGroupConversationInRecords(state.conversations, conversationId, patch);
        if (!conversations) return state;
        return {
          conversations: sortConversations(conversations),
          ...markConversationDirty(state, conversationId)
        };
      });
      flushChatPersistenceIfHydrated(get, 'update-group-conversation-flush');
    },

    touchConversation: (conversationId) => {
      set((state) => ({
        conversations: sortConversations(touchConversationInRecords(state.conversations, conversationId)),
        ...markConversationDirty(state, conversationId)
      }));
    },

    renameConversation: (conversationId, title) => {
      set((state) => {
        const conversations = renameConversationInRecords(state.conversations, conversationId, title);
        if (!conversations) return state;
        return {
          conversations: sortConversations(conversations),
          ...markConversationDirty(state, conversationId)
        };
      });
    },

    toggleConversationPinned: (conversationId) => {
      set((state) => ({
        conversations: sortConversations(toggleConversationPinnedInRecords(state.conversations, conversationId)),
        ...markConversationDirty(state, conversationId)
      }));
    },

    orphanConversation: (conversationId) => {
      set((state) => ({
        conversations: orphanConversationInRecords(state.conversations, conversationId),
        ...markConversationDirty(state, conversationId)
      }));
    }
  };
}
