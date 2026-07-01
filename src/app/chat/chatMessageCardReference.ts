import type { ChatCardReference, ChatMessage, CodeCard } from '../../types/domain';
import type { CodeBlockCandidate } from '../../engines/codeCardEngine';

export function findLatestUserCardReference(messages: ChatMessage[]): ChatCardReference | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate || candidate.role !== 'user') {
      continue;
    }

    return candidate.cardReference ?? null;
  }

  return null;
}

export function findLatestUserContinueCardReference(messages: ChatMessage[]): ChatCardReference | null {
  const reference = findLatestUserCardReference(messages);
  return reference?.mode === 'continue' ? reference : null;
}

export function findContinueCardReferenceForAssistantMessage(
  messages: ChatMessage[],
  assistantMessageId: string
): ChatCardReference | null {
  const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
  if (assistantIndex <= 0) return null;

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate) continue;

    if (candidate.role === 'assistant' && !candidate.toolInvocation) {
      return null;
    }

    if (candidate.role !== 'user') {
      continue;
    }

    return findLatestUserContinueCardReference(messages.slice(0, index + 1));
  }

  return null;
}

export function resolveContinueCardTargetForAssistantMessage(
  messages: ChatMessage[],
  assistantMessageId: string,
  cards: CodeCard[],
  cardsById?: ReadonlyMap<string, CodeCard>
): CodeCard | null {
  const reference = findContinueCardReferenceForAssistantMessage(messages, assistantMessageId);
  if (!reference) return null;
  const indexedCard = cardsById?.get(reference.id);
  if (indexedCard) return indexedCard;
  return cards.find((card) => card.id === reference.id) ?? null;
}

export function resolveContinuationCodeBlockState(args: {
  messages: ChatMessage[];
  assistantMessageId: string;
  cards: CodeCard[];
  cardsById?: ReadonlyMap<string, CodeCard>;
  codeBlocks: CodeBlockCandidate[];
}) {
  const { messages, assistantMessageId, cards, cardsById, codeBlocks } = args;
  const targetCard = resolveContinueCardTargetForAssistantMessage(messages, assistantMessageId, cards, cardsById);
  const primaryBlock = codeBlocks[0] ?? null;
  if (!targetCard || !primaryBlock) return null;

  return {
    targetCard,
    primaryBlock,
    isSynced: primaryBlock.code.trim() === targetCard.code.trim()
  };
}
