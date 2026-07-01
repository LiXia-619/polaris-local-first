import { useEffect } from 'react';
import type { ChatMessage } from '../../../../types/domain';
import type { ChatUiState } from '../context/ChatUiState';

export function useCleanupEditingEffect(ui: ChatUiState, visibleMessages: ChatMessage[]) {
  const editingMessageId = ui.editing?.messageId ?? null;
  const { setEditing } = ui;

  useEffect(() => {
    if (!editingMessageId) return;
    if (visibleMessages.some((message) => message.id === editingMessageId)) return;
    setEditing(null);
  }, [editingMessageId, setEditing, visibleMessages]);
}
