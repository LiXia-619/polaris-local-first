import { useEffect } from 'react';
import type { ChatUiState } from '../context/ChatUiState';

export function useResetUiStateOnConversationChange(
  activeConversationId: string | null,
  ui: ChatUiState
) {
  const {
    clearCommandStatus,
    setDragActive,
    setEditing,
    setCollapsedThinkingMessageIds,
    setSeenThinkingMessageIds,
    setThinkingSummaryMessageId,
    setExpandedCodeMessageIds
  } = ui;

  useEffect(() => {
    clearCommandStatus();
    setDragActive(false);
    setEditing(null);
    setCollapsedThinkingMessageIds([]);
    setSeenThinkingMessageIds([]);
    setThinkingSummaryMessageId(null);
    setExpandedCodeMessageIds([]);
  }, [
    activeConversationId,
    clearCommandStatus,
    setCollapsedThinkingMessageIds,
    setDragActive,
    setEditing,
    setExpandedCodeMessageIds,
    setSeenThinkingMessageIds,
    setThinkingSummaryMessageId
  ]);
}
