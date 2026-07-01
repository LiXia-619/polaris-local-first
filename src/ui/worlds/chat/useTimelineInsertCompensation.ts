import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { ChatMessage } from '../../../types/domain';

type TimelineSnapshot = {
  messageIds: string[];
  scrollHeight: number;
};

type UseTimelineInsertCompensationArgs = {
  flowRef: RefObject<HTMLDivElement>;
  liveMode: boolean;
  messages: ChatMessage[];
};

function runWithInstantScroll(container: HTMLDivElement, action: () => void) {
  const previousBehavior = container.style.scrollBehavior;
  container.style.scrollBehavior = 'auto';
  action();
  window.requestAnimationFrame(() => {
    if (container.style.scrollBehavior === 'auto') {
      container.style.scrollBehavior = previousBehavior;
    }
  });
}

export function useTimelineInsertCompensation({
  flowRef,
  liveMode,
  messages
}: UseTimelineInsertCompensationArgs) {
  const snapshotRef = useRef<TimelineSnapshot | null>(null);

  useLayoutEffect(() => {
    const container = flowRef.current;
    if (!container) return;

    const previous = snapshotRef.current;
    if (previous && !liveMode && messages.length > previous.messageIds.length) {
      const previousIds = new Set(previous.messageIds);
      const insertedToolEvents = messages.filter(
        (message) => !previousIds.has(message.id) && Boolean(message.toolInvocation)
      );
      const scrollHeightDelta = container.scrollHeight - previous.scrollHeight;

      if (insertedToolEvents.length > 0 && scrollHeightDelta > 0) {
        runWithInstantScroll(container, () => {
          container.scrollTop += scrollHeightDelta;
        });
      }
    }

    snapshotRef.current = {
      messageIds: messages.map((message) => message.id),
      scrollHeight: container.scrollHeight
    };
  }, [flowRef, liveMode, messages]);
}
