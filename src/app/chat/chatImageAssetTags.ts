import { inferImageAssetTags, normalizeImageAssetTags } from '../../engines/imageAssetTags';
import type { ChatAttachment, ChatMessage } from '../../types/domain';

function collectMessageHints(message: ChatMessage) {
  const hints: string[] = [];

  if (message.toolInvocation?.kind === 'createQrCode') {
    hints.push('二维码');
  }

  if (message.toolInvocation && message.toolInvocation.kind !== 'createQrCode') {
    hints.push('生成图');
  }

  if (message.role === 'assistant' && !message.toolInvocation) {
    hints.push('生成图');
  }

  if (message.role === 'user') {
    hints.push('参考图');
  }

  return hints;
}

export function inferChatImageAssetTags(message: ChatMessage, attachment: ChatAttachment) {
  const titleHints = inferImageAssetTags({
    title: message.toolInvocation?.title || message.content,
    imageName: attachment.name
  });

  return normalizeImageAssetTags([
    ...collectMessageHints(message),
    ...titleHints
  ]);
}

