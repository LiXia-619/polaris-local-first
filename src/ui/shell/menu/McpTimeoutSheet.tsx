import { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n';

type McpTimeoutSheetProps = {
  open: boolean;
  timeoutSeconds: number;
  onClose: () => void;
  onSave: (seconds: number) => void;
};

export function McpTimeoutSheet({
  open,
  timeoutSeconds,
  onClose,
  onSave
}: McpTimeoutSheetProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(timeoutSeconds));

  useEffect(() => {
    if (!open) return;
    setDraft(String(timeoutSeconds));
  }, [open, timeoutSeconds]);

  if (!open) return null;

  const submit = () => {
    const seconds = Number(draft.trim());
    if (!Number.isFinite(seconds) || seconds < 1) {
      window.alert(t('settings.mcp.timeoutInvalid'));
      return;
    }
    onSave(Math.floor(seconds));
    onClose();
  };

  return (
    <div className="mcp-inline-sheet-overlay" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="mcp-inline-sheet mcp-inline-sheet--compact" role="dialog" aria-modal="true" aria-label={t('settings.mcp.timeoutTitle')}>
        <div className="sheet-handle" />
        <div className="mcp-inline-sheet-header centered">
          <strong>{t('settings.mcp.timeoutTitle')}</strong>
        </div>

        <div className="settings-form mcp-settings-form">
          <label>
            {t('settings.mcp.timeoutLabel')}
            <input value={draft} onChange={(event) => setDraft(event.target.value)} inputMode="numeric" />
          </label>
          <p className="settings-note">{t('settings.mcp.timeoutNote')}</p>
        </div>

        <div className="mcp-inline-sheet-actions">
          <button type="button" className="mcp-btn secondary" onClick={onClose}>
            {t('settings.mcp.close')}
          </button>
          <button type="button" className="mcp-btn primary" onClick={submit}>
            {t('settings.mcp.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
