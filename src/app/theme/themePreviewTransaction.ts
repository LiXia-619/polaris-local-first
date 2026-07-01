import type { ChatMessage, ThemeFrame } from '../../types/domain';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ActiveThemePreview } from '../../stores/spaceStoreTypes';
import { resolveExternalThemePreviewStatus } from '../../stores/spaceStorePreviewState';

type ThemePreviewMessageStatus = 'applied' | 'rolled_back' | 'superseded';

type ThemePreviewChatBridge = {
  updateMessage: (target: WritableConversationBody, messageId: string, patch: Partial<ChatMessage>) => void;
};

function resolvePreviewMessageContent(
  status: ThemePreviewMessageStatus,
  foldedIntoPreviewId?: string
) {
  if (status === 'applied') return null;
  if (status === 'rolled_back') return '这次试穿已取消。';
  return foldedIntoPreviewId ? '这版试穿已被后续版本替换。' : '这版试穿已被后续调整覆盖。';
}

function findPreviewMessage(
  target: WritableConversationBody,
  previewId: string
) {
  return [...target.messages]
    .reverse()
    .find((message) => message.toolInvocation?.previewId === previewId) ?? null;
}

export function updateThemePreviewMessage(params: {
  chat: ThemePreviewChatBridge;
  target: WritableConversationBody;
  previewId: string;
  status: ThemePreviewMessageStatus;
  foldedIntoPreviewId?: string;
}) {
  const { chat, target, previewId, status, foldedIntoPreviewId } = params;
  const previewMessage = findPreviewMessage(target, previewId);
  const previewInvocation = previewMessage?.toolInvocation;
  if (!previewMessage || !previewInvocation || previewInvocation.status !== 'preview') return false;

  chat.updateMessage(target, previewMessage.id, {
    content: resolvePreviewMessageContent(status, foldedIntoPreviewId) ?? previewInvocation.summary,
    toolInvocation: {
      ...previewInvocation,
      status,
      foldedIntoPreviewId
    }
  });
  return true;
}

export function updateThemePreviewMessageFromToolEvent(params: {
  chat: ThemePreviewChatBridge;
  target: WritableConversationBody;
  message: ChatMessage;
  status: ThemePreviewMessageStatus;
  foldedIntoPreviewId?: string;
}) {
  const { chat, target, message, status, foldedIntoPreviewId } = params;
  const previewId = message.toolInvocation?.previewId;
  if (!previewId) return false;

  return updateThemePreviewMessage({
    chat,
    target,
    previewId,
    status,
    foldedIntoPreviewId
  });
}

export function finalizeResolvedThemePreview(params: {
  chat: ThemePreviewChatBridge;
  target: WritableConversationBody;
  activePreview: ActiveThemePreview;
  nextTheme: ThemeFrame;
  foldedIntoPreviewId?: string;
}) {
  const { chat, target, activePreview, nextTheme, foldedIntoPreviewId } = params;
  if (!activePreview) return false;

  const status = resolveExternalThemePreviewStatus(activePreview, nextTheme) ?? 'superseded';
  return updateThemePreviewMessage({
    chat,
    target,
    previewId: activePreview.id,
    status,
    foldedIntoPreviewId
  });
}
