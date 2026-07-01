import type { ChatMessage, Conversation } from '../types/domain';

function cleanTitleText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function deriveAttachmentTitle(message: ChatMessage): string {
  const attachments = message.attachments ?? [];
  const firstAttachment = attachments[0];
  if (!firstAttachment) return '新对话';

  if (firstAttachment.kind === 'image') {
    return attachments.length > 1 ? `图片对话 +${attachments.length - 1}` : '图片对话';
  }

  const stem = cleanTitleText(firstAttachment.name.replace(/\.[^.]+$/, ''));
  return stem || '附件对话';
}

export function deriveMessageTitle(message: ChatMessage | undefined): string {
  if (!message) return '新对话';
  return cleanTitleText(message.content)
    || cleanTitleText(message.cardReference?.title ?? '')
    || deriveAttachmentTitle(message);
}

function deriveAutoConversationTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user' && !message.toolInvocation);
  return deriveMessageTitle(firstUserMessage);
}

function deriveLegacyAttachmentTitle(message: ChatMessage): string {
  const attachments = message.attachments ?? [];
  const firstAttachment = attachments[0];
  if (!firstAttachment) return '新对话';

  if (firstAttachment.kind === 'image') {
    return attachments.length > 1 ? `图片对话 +${attachments.length - 1}` : '图片对话';
  }

  const stem = firstAttachment.name.replace(/\.[^.]+$/, '').trim();
  return stem.slice(0, 14) || '附件对话';
}

function deriveLegacyMessageTitle(message: ChatMessage | undefined): string {
  if (!message) return '新对话';
  return message.content.slice(0, 14) || message.cardReference?.title.slice(0, 14) || deriveLegacyAttachmentTitle(message);
}

function deriveLegacyAutoConversationTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user' && !message.toolInvocation);
  return deriveLegacyMessageTitle(firstUserMessage);
}

function isGeneratedConversationTitle(title: string, messages: ChatMessage[]): boolean {
  const autoTitle = deriveAutoConversationTitle(messages);
  const legacyAutoTitle = deriveLegacyAutoConversationTitle(messages);
  return title === autoTitle || (legacyAutoTitle !== autoTitle && title === legacyAutoTitle);
}

export function resolveConversationTitle(
  currentTitle: string,
  previousMessages: ChatMessage[],
  nextMessages: ChatMessage[]
): string {
  const nextAutoTitle = deriveAutoConversationTitle(nextMessages);

  if (!currentTitle.trim() || currentTitle === '新对话' || isGeneratedConversationTitle(currentTitle, previousMessages)) {
    return nextAutoTitle;
  }

  return currentTitle;
}

export function normalizeConversationTitle(
  title: string | undefined,
  messages: ChatMessage[]
): string {
  return resolveConversationTitle(title?.trim() ?? '', messages, messages);
}

export function displayConversationTitle(
  conversation: Pick<Conversation, 'title' | 'messages'>
): string {
  return normalizeConversationTitle(conversation.title, conversation.messages);
}
