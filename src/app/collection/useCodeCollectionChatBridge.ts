import { useCallback, useMemo } from 'react';
import { codeCardOriginLabel } from '../../engines/collectionCardOrigin';
import { enterChatWorld } from '../shell/frontstageNavigation';
import type { ChatCardReference, CodeCard, Conversation, Persona, World } from '../../types/domain';
import {
  buildCardReference,
  buildChatPromptFromCard,
  buildChatPromptFromSourceCard,
  codeCardSourceContext,
  type CodeCardSourceContext,
  type CodeChatPromptSeed
} from './codeCollectionSource';

type UseCodeCollectionChatBridgeInput = {
  cards: CodeCard[];
  activeCardId: string | null;
  conversations: Conversation[];
  collaborators: Persona[];
  activeConversationId: string | null;
  createConversation: () => string;
  setActiveConversation: (conversationId: string) => void;
  setFocusedMessageTarget: (target: { conversationId: string; messageId: string } | null) => void;
  clearPendingAttachments: () => void;
  setInputDraft: (draft: string) => void;
  setPendingCardReference: (reference: ChatCardReference | null) => void;
  setActiveCard: (cardId: string | null) => void;
  setWorld: (world: World) => void;
  onCloseWorkshop: () => void;
};

export function useCodeCollectionChatBridge({
  cards,
  activeCardId,
  conversations,
  collaborators,
  activeConversationId,
  createConversation,
  setActiveConversation,
  setFocusedMessageTarget,
  clearPendingAttachments,
  setInputDraft,
  setPendingCardReference,
  setActiveCard,
  setWorld,
  onCloseWorkshop
}: UseCodeCollectionChatBridgeInput) {
  const activeCard = useMemo(
    () => (activeCardId ? cards.find((card) => card.id === activeCardId) ?? null : null),
    [activeCardId, cards]
  );

  const activeCardOriginLabel = useMemo(
    () => (activeCard ? codeCardOriginLabel(activeCard, conversations, collaborators) : null),
    [activeCard, collaborators, conversations]
  );

  const activeCardSourceContext = useMemo(
    () => (activeCard ? codeCardSourceContext(activeCard, conversations, collaborators) : null),
    [activeCard, collaborators, conversations]
  );

  const resolveOriginCopy = useCallback(
    (card: CodeCard) => codeCardOriginLabel(card, conversations, collaborators),
    [collaborators, conversations]
  );

  const openChat = useCallback(() => {
    enterChatWorld({ setWorld });
    onCloseWorkshop();
  }, [onCloseWorkshop, setWorld]);

  const openSourceContext = useCallback((card: CodeCard) => {
    const sourceContext = codeCardSourceContext(card, conversations, collaborators);
    if (!sourceContext) return;

    if (sourceContext.conversationId !== activeConversationId) {
      clearPendingAttachments();
    }
    setActiveConversation(sourceContext.conversationId);
    setPendingCardReference(null);
    setFocusedMessageTarget({
      conversationId: sourceContext.conversationId,
      messageId: sourceContext.messageId
    });
    enterChatWorld({ setWorld });
    onCloseWorkshop();
  }, [activeConversationId, clearPendingAttachments, collaborators, conversations, onCloseWorkshop, setActiveConversation, setFocusedMessageTarget, setWorld]);

  const promptChatCard = useCallback((card?: CodeChatPromptSeed | null) => {
    const conversationId = activeConversationId ?? activeCardSourceContext?.conversationId ?? createConversation();
    if (conversationId !== activeConversationId) {
      clearPendingAttachments();
    }
    setActiveConversation(conversationId);
    setFocusedMessageTarget(null);
    setPendingCardReference(card ? buildCardReference(card, 'continue') : null);
    setActiveCard(card?.id ?? activeCardId ?? null);
    setInputDraft(buildChatPromptFromCard(card));
    enterChatWorld({ setWorld });
    onCloseWorkshop();
  }, [
    activeCardSourceContext,
    activeCardId,
    activeConversationId,
    clearPendingAttachments,
    createConversation,
    onCloseWorkshop,
    setActiveCard,
    setActiveConversation,
    setFocusedMessageTarget,
    setInputDraft,
    setPendingCardReference,
    setWorld
  ]);

  const promptChatFromSource = useCallback((card: CodeCard, sourceContext?: CodeCardSourceContext | null) => {
    const resolvedSourceContext = sourceContext ?? codeCardSourceContext(card, conversations, collaborators);
    if (!resolvedSourceContext) return;

    if (resolvedSourceContext.conversationId !== activeConversationId) {
      clearPendingAttachments();
    }
    setActiveConversation(resolvedSourceContext.conversationId);
    setFocusedMessageTarget({
      conversationId: resolvedSourceContext.conversationId,
      messageId: resolvedSourceContext.messageId
    });
    setPendingCardReference(buildCardReference(card, 'continue'));
    setActiveCard(card.id);
    setInputDraft(buildChatPromptFromSourceCard(card, resolvedSourceContext));
    enterChatWorld({ setWorld });
    onCloseWorkshop();
  }, [
    activeConversationId,
    clearPendingAttachments,
    collaborators,
    conversations,
    onCloseWorkshop,
    setActiveCard,
    setActiveConversation,
    setFocusedMessageTarget,
    setInputDraft,
    setPendingCardReference,
    setWorld
  ]);

  return {
    activeCard,
    activeCardOriginLabel,
    activeCardSourceContext,
    resolveOriginCopy,
    openChat,
    openSourceContext,
    promptChatCard,
    promptChatFromSource
  };
}
