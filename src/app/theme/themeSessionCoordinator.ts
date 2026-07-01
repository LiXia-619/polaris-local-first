import type { ChatMessage, ThemeFrame } from '../../types/domain';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ActiveThemePreview } from '../../stores/spaceStoreTypes';
import {
  finalizeResolvedThemePreview,
  updateThemePreviewMessage,
  updateThemePreviewMessageFromToolEvent
} from './themePreviewTransaction';

type ThemeSessionChatBridge = {
  getConversationWritable: (conversationId: string) => WritableConversationBody | null;
  updateMessage: (target: WritableConversationBody, messageId: string, patch: Partial<import('../../types/domain').ChatMessage>) => void;
};

type ThemeSessionStateBridge = {
  getActiveThemePreview: () => ActiveThemePreview;
  getCurrentThemeFrame: () => ThemeFrame;
  rollbackThemePreview: (previewId: string) => boolean;
};

export type ThemeSessionCoordinator = {
  runExternalThemeMutation: (mutate: () => void) => void;
  rollbackPreviewForConversationDeletion: (conversationId: string) => boolean;
};

export type ThemePreviewCoordinator = {
  finalizeResolvedPreview: (
    activePreview: ActiveThemePreview,
    nextTheme: ThemeFrame,
    foldedIntoPreviewId?: string
  ) => boolean;
  applyPreviewFromToolEvent: (target: WritableConversationBody, message: ChatMessage) => boolean;
  rollbackPreview: (target: WritableConversationBody, previewId: string) => boolean;
};

function finalizeExitedPreview(params: {
  chat: ThemeSessionChatBridge;
  activePreviewBefore: ActiveThemePreview;
  nextActivePreview: ActiveThemePreview;
  nextTheme: ThemeFrame;
}) {
  const { chat, activePreviewBefore, nextActivePreview, nextTheme } = params;
  if (!activePreviewBefore) return false;
  if (nextActivePreview?.id === activePreviewBefore.id) return false;
  const target = chat.getConversationWritable(activePreviewBefore.conversationId);
  if (!target) return false;

  return finalizeResolvedThemePreview({
    chat,
    target,
    activePreview: activePreviewBefore,
    nextTheme
  });
}

export function createThemePreviewCoordinator(chat: ThemeSessionChatBridge): ThemePreviewCoordinator {
  return {
    finalizeResolvedPreview(activePreview, nextTheme, foldedIntoPreviewId) {
      if (!activePreview) return false;
      const target = chat.getConversationWritable(activePreview.conversationId);
      if (!target) return false;
      return finalizeResolvedThemePreview({
        chat,
        target,
        activePreview,
        nextTheme,
        foldedIntoPreviewId
      });
    },
    applyPreviewFromToolEvent(target, message) {
      return updateThemePreviewMessageFromToolEvent({
        chat,
        target,
        message,
        status: 'applied'
      });
    },
    rollbackPreview(target, previewId) {
      return updateThemePreviewMessage({
        chat,
        target,
        previewId,
        status: 'rolled_back'
      });
    }
  };
}

export function createThemeSessionCoordinator(params: {
  chat: ThemeSessionChatBridge;
  state: ThemeSessionStateBridge;
}): ThemeSessionCoordinator {
  const { chat, state } = params;

  return {
    runExternalThemeMutation(mutate) {
      const activePreviewBefore = state.getActiveThemePreview();
      mutate();
      finalizeExitedPreview({
        chat,
        activePreviewBefore,
        nextActivePreview: state.getActiveThemePreview(),
        nextTheme: state.getCurrentThemeFrame()
      });
    },
    rollbackPreviewForConversationDeletion(conversationId) {
      const activePreview = state.getActiveThemePreview();
      if (!activePreview || activePreview.conversationId !== conversationId) return false;
      return state.rollbackThemePreview(activePreview.id);
    }
  };
}
