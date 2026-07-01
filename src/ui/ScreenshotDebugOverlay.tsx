import type { AppTopbarState } from './shell/AppTopbar';

type ScreenshotDebugOverlayProps = {
  visible: boolean;
  capturedAt: number | null;
  topbarState: AppTopbarState;
  activeConversationTitle: string | null;
  activeConversationMessageCount: number;
  activeConversationCollaboratorName: string | null;
  frontstageCollaboratorName: string | null;
};

function formatTimestamp(at: number | null) {
  if (!at) return '--:--:--';
  return new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function ScreenshotDebugOverlay({
  visible,
  capturedAt,
  topbarState,
  activeConversationTitle,
  activeConversationMessageCount,
  activeConversationCollaboratorName,
  frontstageCollaboratorName
}: ScreenshotDebugOverlayProps) {
  if (!visible) return null;

  const keyboardOpen = typeof document !== 'undefined' && document.documentElement.dataset.keyboardOpen === 'true';
  const focusLabel = topbarState.activeWorld === 'chat'
    ? activeConversationTitle || '未命名对话'
    : `${topbarState.collectionShelf} shelf`;
  const collaboratorLabel = topbarState.activeWorld === 'chat'
    ? (activeConversationCollaboratorName || '未绑定协作者')
    : (frontstageCollaboratorName || '全部视角');
  const flagText = [
    `menu ${Number(topbarState.menuOpen)}`,
    `search ${Number(topbarState.searchOpen)}`,
    `panel ${Number(topbarState.collaboratorSwitchOpen)}`,
    `info ${Number(topbarState.collectionInfoFullscreenOpen)}`,
    `preview ${Number(Boolean(topbarState.activeThemePreview))}`,
    `kbd ${Number(keyboardOpen)}`
  ].join(' · ');

  return (
    <aside className="screenshot-debug-overlay" aria-hidden="true">
      <div className="screenshot-debug-overlay__header">
        <strong>screenshot debug</strong>
        <span>{formatTimestamp(capturedAt)}</span>
      </div>
      <span>{`${topbarState.activeWorld} · ${topbarState.worldLabel}`}</span>
      <span>{`title ${topbarState.title}`}</span>
      <span>{`focus ${focusLabel}`}</span>
      <span>{`collab ${collaboratorLabel}`}</span>
      {topbarState.activeWorld === 'chat' ? (
        <span>{`messages ${activeConversationMessageCount}`}</span>
      ) : null}
      {topbarState.worldDetail ? (
        <span>{`detail ${topbarState.worldDetail}`}</span>
      ) : null}
      <span>{flagText}</span>
    </aside>
  );
}
