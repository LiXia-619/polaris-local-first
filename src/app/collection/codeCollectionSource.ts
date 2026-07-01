import { resolveOwnerCollaboratorId } from '../../engines/collectionOwnership';
import { codeCardBlockLabel } from '../../engines/collectionCardOrigin';
import type { ChatCardReference, ChatMessage, CodeCard, Conversation, Persona } from '../../types/domain';

export type CodeChatPromptSeed = Pick<CodeCard, 'id' | 'title' | 'cardNote' | 'language' | 'code' | 'cardFaceCss'>;

export type CodeCardSourceContext = {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  messagePreview: string;
  blockLabel: string | null;
  messageRole: ChatMessage['role'];
  messageTimestamp: number;
  collaboratorName: string;
};

export function buildCardReference(card: CodeChatPromptSeed, mode: ChatCardReference['mode']): ChatCardReference {
  return {
    id: card.id,
    title: card.title,
    cardNote: card.cardNote,
    language: card.language,
    code: card.code,
    cardFaceCss: card.cardFaceCss,
    mode
  };
}

export function resolveChatCardReference(
  reference: ChatCardReference | null | undefined,
  cards: CodeCard[]
): ChatCardReference | null {
  if (!reference) return null;

  const currentCard = cards.find((card) => card.id === reference.id) ?? null;
  if (!currentCard) return reference;

  return {
    ...reference,
    title: currentCard.title,
    cardNote: currentCard.cardNote,
    language: currentCard.language,
    code: currentCard.code,
    cardFaceCss: currentCard.cardFaceCss
  };
}

function buildMessagePreview(message: ChatMessage) {
  const compact = message.content.replace(/\s+/g, ' ').trim();
  if (compact) return compact.slice(0, 140);
  if (message.attachments?.length) {
    return `附件：${message.attachments.map((attachment) => attachment.name).join('、')}`;
  }
  return '这条消息没有正文。';
}

export function buildChatPromptFromCard(card: CodeChatPromptSeed | null | undefined) {
  if (!card) {
    return '帮我生成一张新卡片：';
  }

  return [
    '继续沿着这张卡往下写。',
    '优先增量续写或修改；内容很长时分小块推进，不要一次重发完整新版。'
  ].join('\n');
}

export function buildChatPromptFromSourceCard(card: CodeCard, sourceContext: CodeCardSourceContext) {
  return [
    `继续沿着《${sourceContext.conversationTitle}》里那条来源消息往下写这张卡。`,
    `来源协作者：${sourceContext.collaboratorName}`,
    sourceContext.blockLabel ? `来源代码：${sourceContext.blockLabel}` : null,
    `来源片段：${sourceContext.messagePreview}`,
    '优先增量续写或修改；内容很长时分小块推进，不要一次重发完整新版。'
  ].filter(Boolean).join('\n');
}

export function codeCardSourceContext(
  card: CodeCard,
  conversations: Conversation[],
  collaborators: Persona[]
): CodeCardSourceContext | null {
  if (!card.originConversationId || !card.originMessageId) return null;

  const conversation = conversations.find((entry) => entry.id === card.originConversationId);
  if (!conversation) return null;

  const message = conversation.messages.find((entry) => entry.id === card.originMessageId);
  if (!message) return null;

  return {
    conversationId: conversation.id,
    conversationTitle: conversation.title,
    messageId: message.id,
    messagePreview: buildMessagePreview(message),
    blockLabel: codeCardBlockLabel(card),
    messageRole: message.role,
    messageTimestamp: message.timestamp,
    collaboratorName:
      collaborators.find((collaborator) => collaborator.id === resolveOwnerCollaboratorId(card, conversations))?.name
      ?? '未知协作者'
  };
}
