import { ImpactStyle } from '@capacitor/haptics';
import type { ChatMessage } from '../../../../types/domain';
import { runImpactAction, runSelectionAction } from '../../../haptics';
import { useI18n } from '../../../../i18n';

type ComposerPreviewStripProps = {
  message: ChatMessage;
  onApply: (message: ChatMessage) => void;
  onSave: (message: ChatMessage) => void;
  onRollback: (message: ChatMessage) => void;
};

export function ComposerPreviewStrip({
  message,
  onApply,
  onSave,
  onRollback
}: ComposerPreviewStripProps) {
  const { t } = useI18n();

  if (message.toolInvocation?.status !== 'preview') return null;

  return (
    <div className="active-preview-strip">
      <div className="active-preview-copy">
        <div className="active-preview-kicker">{t('chat.previewStrip.kicker')}</div>
        <strong>{message.toolInvocation.title}</strong>
        <p>{message.toolInvocation.summary}</p>
      </div>
      <div className="active-preview-actions">
        <button
          type="button"
          className="tool-btn primary compact"
          onClick={(event) => {
            runImpactAction(() => onApply(message), { element: event.currentTarget, style: ImpactStyle.Light });
          }}
        >
          {t('chat.previewStrip.apply')}
        </button>
        <button
          type="button"
          className="tool-btn compact"
          onClick={(event) => {
            runImpactAction(() => onSave(message), { element: event.currentTarget, style: ImpactStyle.Light });
          }}
        >
          {t('chat.previewStrip.saveTheme')}
        </button>
        <button
          type="button"
          className="tool-btn compact"
          onClick={(event) => {
            runSelectionAction(() => onRollback(message), { element: event.currentTarget });
          }}
        >
          {t('chat.previewStrip.rollback')}
        </button>
      </div>
    </div>
  );
}
