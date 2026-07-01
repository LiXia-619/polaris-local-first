import type { ChatUiGenerationControls } from '../../../app/chat/chatPorts';

export function cancelChatStreaming(ui: ChatUiGenerationControls) {
  const { abortControllerRef, streamingLifecycleReleaseRef, setSending, setStreaming } = ui;
  if (streamingLifecycleReleaseRef.current !== null) {
    window.clearTimeout(streamingLifecycleReleaseRef.current);
    streamingLifecycleReleaseRef.current = null;
  }
  abortControllerRef.current?.abort();
  abortControllerRef.current = null;
  setSending(false);
  setStreaming(null);
}
