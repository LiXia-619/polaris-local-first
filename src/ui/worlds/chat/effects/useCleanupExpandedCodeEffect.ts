import { useEffect } from 'react';
import type { ChatMessage } from '../../../../types/domain';
import type { ChatUiState } from '../context/ChatUiState';

export function useCleanupExpandedCodeEffect(ui: ChatUiState, visibleMessages: ChatMessage[]) {
  const { setExpandedCodeMessageIds } = ui;

  useEffect(() => {
    setExpandedCodeMessageIds((current) => {
      const next = current.filter((id) => visibleMessages.some((message) => message.id === id));
      return next.length === current.length ? current : next;
    });
  }, [setExpandedCodeMessageIds, visibleMessages]);
}
