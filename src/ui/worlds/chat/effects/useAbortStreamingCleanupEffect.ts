import { useEffect } from 'react';
import type { ChatUiState } from '../context/ChatUiState';

export function useAbortStreamingCleanupEffect(ui: ChatUiState) {
  const { cancelAllGenerations } = ui;

  useEffect(
    () => () => {
      cancelAllGenerations();
    },
    [cancelAllGenerations]
  );
}
