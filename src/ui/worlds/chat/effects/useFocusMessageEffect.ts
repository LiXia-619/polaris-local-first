import { useLayoutEffect } from 'react';
import type { ChatMessage } from '../../../../types/domain';

const FOCUS_VISIBILITY_PADDING = 28;

export function useFocusMessageEffect(args: {
  focusedMessageId: string | null;
  visibleMessages: ChatMessage[];
  setFocusedMessageTarget: (value: { conversationId: string; messageId: string } | null) => void;
}) {
  const { focusedMessageId, visibleMessages, setFocusedMessageTarget } = args;

  useLayoutEffect(() => {
    if (!focusedMessageId) return;
    if (!visibleMessages.some((message) => message.id === focusedMessageId)) {
      setFocusedMessageTarget(null);
      return;
    }

    let rafId = 0;

    const ensureMessageVisible = () => {
      const container = document.querySelector<HTMLElement>('.chat-flow');
      const target = document.querySelector<HTMLElement>(`[data-message-id="${focusedMessageId}"]`);
      if (!container || !target) {
        setFocusedMessageTarget(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const visibleTop = containerRect.top + FOCUS_VISIBILITY_PADDING;
      const visibleBottom = containerRect.bottom - FOCUS_VISIBILITY_PADDING;
      const alreadyVisible = targetRect.top >= visibleTop && targetRect.bottom <= visibleBottom;

      if (!alreadyVisible) {
        target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }

      setFocusedMessageTarget(null);
    };

    rafId = window.requestAnimationFrame(() => {
      ensureMessageVisible();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [focusedMessageId, setFocusedMessageTarget, visibleMessages]);
}
