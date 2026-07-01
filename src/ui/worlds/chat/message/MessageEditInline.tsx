import { useEffect, useRef } from 'react';
import type { ChatAttachment, ChatMessage } from '../../../../types/domain';
import type { ChatEditingState } from '../context/ChatUiState';
import { ChatAttachmentStrip } from '../ChatAttachmentStrip';
import { useI18n } from '../../../../i18n';

const EDITING_TEXT_INTERACTION_CLASS = 'chat-flow--message-editing-text-interaction';

type MessageEditInlineProps = {
  editing: Exclude<ChatEditingState, null>;
  message: ChatMessage;
  onRemoveEditingAttachment: (attachmentId: string) => void;
  onUpdateEditingDraft: (value: string) => void;
  onCommitEdit: (message: ChatMessage) => Promise<void>;
  onCancelEdit: () => void;
};

export function MessageEditInline({
  editing,
  message,
  onRemoveEditingAttachment,
  onUpdateEditingDraft,
  onCommitEdit,
  onCancelEdit
}: MessageEditInlineProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    const timeline = textarea?.closest('.chat-flow');
    const shell = textarea?.closest('.app-shell');
    let textGestureActive = false;
    let releaseTimer: number | null = null;

    shell?.classList.add('app-shell--message-editing-text');

    const syncTimelineLock = () => {
      if (!textarea || (!textGestureActive && document.activeElement !== textarea)) {
        textGestureActive = false;
        timeline?.classList.remove(EDITING_TEXT_INTERACTION_CLASS);
        return;
      }
      const hasSelection = document.activeElement === textarea && textarea.selectionStart !== textarea.selectionEnd;
      timeline?.classList.toggle(EDITING_TEXT_INTERACTION_CLASS, textGestureActive || hasSelection);
    };

    const beginTextGesture = () => {
      if (releaseTimer !== null) {
        window.clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      textGestureActive = true;
      syncTimelineLock();
    };

    const endTextGesture = () => {
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        textGestureActive = false;
        releaseTimer = null;
        syncTimelineLock();
      }, 160);
    };

    document.addEventListener('selectionchange', syncTimelineLock);
    textarea?.addEventListener('select', syncTimelineLock);
    textarea?.addEventListener('keyup', syncTimelineLock);
    textarea?.addEventListener('input', syncTimelineLock);
    textarea?.addEventListener('blur', syncTimelineLock);
    textarea?.addEventListener('pointerdown', beginTextGesture);
    textarea?.addEventListener('pointerup', endTextGesture);
    textarea?.addEventListener('pointercancel', endTextGesture);
    textarea?.addEventListener('touchstart', beginTextGesture);
    textarea?.addEventListener('touchend', endTextGesture);
    textarea?.addEventListener('touchcancel', endTextGesture);
    syncTimelineLock();

    return () => {
      if (releaseTimer !== null) window.clearTimeout(releaseTimer);
      document.removeEventListener('selectionchange', syncTimelineLock);
      textarea?.removeEventListener('select', syncTimelineLock);
      textarea?.removeEventListener('keyup', syncTimelineLock);
      textarea?.removeEventListener('input', syncTimelineLock);
      textarea?.removeEventListener('blur', syncTimelineLock);
      textarea?.removeEventListener('pointerdown', beginTextGesture);
      textarea?.removeEventListener('pointerup', endTextGesture);
      textarea?.removeEventListener('pointercancel', endTextGesture);
      textarea?.removeEventListener('touchstart', beginTextGesture);
      textarea?.removeEventListener('touchend', endTextGesture);
      textarea?.removeEventListener('touchcancel', endTextGesture);
      timeline?.classList.remove(EDITING_TEXT_INTERACTION_CLASS);
      shell?.classList.remove('app-shell--message-editing-text');
    };
  }, []);

  return (
    <div className="message-edit-panel">
      <ChatAttachmentStrip attachments={editing.attachments as ChatAttachment[]} tone="message" onRemove={onRemoveEditingAttachment} />
      <textarea
        ref={textareaRef}
        value={editing.draft}
        onChange={(event) => onUpdateEditingDraft(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            void onCommitEdit(message);
          } else if (event.key === 'Escape') {
            onCancelEdit();
          }
        }}
        rows={Math.max(3, editing.draft.split('\n').length)}
        className="message-edit-input"
        placeholder={t('chat.messageEdit.placeholder')}
      />
      <div className="message-edit-hint">{t('chat.messageEdit.hint')}</div>
      <div className="message-inline-actions user">
        <button type="button" className="btn-secondary compact" onClick={onCancelEdit}>
          {t('chat.messageActions.cancel')}
        </button>
        <button type="button" className="btn-secondary compact active" onClick={() => void onCommitEdit(message)}>
          {t('chat.messageEdit.saveAndRetry')}
        </button>
      </div>
    </div>
  );
}
