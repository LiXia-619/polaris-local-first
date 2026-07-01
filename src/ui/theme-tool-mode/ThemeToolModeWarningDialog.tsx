import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n';

type ThemeToolModeWarningDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ThemeToolModeWarningDialog({
  open,
  onCancel,
  onConfirm
}: ThemeToolModeWarningDialogProps) {
  const { t } = useI18n();

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="theme-tool-mode-warning-overlay" role="dialog" aria-modal="true" aria-label={t('theme.toolMode.warningAria')}>
      <div className="theme-tool-mode-warning-card">
        <span className="theme-tool-mode-warning-kicker">{t('theme.toolMode.warningKicker')}</span>
        <p>{t('theme.toolMode.warningBodyPrimary')}</p>
        <p>{t('theme.toolMode.warningBodySecondary')}</p>
        <div className="theme-tool-mode-warning-actions">
          <button type="button" className="theme-tool-mode-warning-btn" onClick={onCancel}>{t('theme.toolMode.warningCancel')}</button>
          <button type="button" className="theme-tool-mode-warning-btn theme-tool-mode-warning-btn-primary" onClick={onConfirm}>{t('theme.toolMode.warningConfirm')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
