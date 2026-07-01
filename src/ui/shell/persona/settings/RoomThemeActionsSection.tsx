import { Icon } from '../../../Icon';
import { useI18n } from '../../../../i18n/useI18n';

type RoomThemeActionsSectionProps = {
  copyFeedback: 'idle' | 'done' | 'failed';
  onCopyThemeBundle: () => void;
  onRollbackLastSkin: () => void;
  onRestoreDefaultTheme: () => void;
};

export function RoomThemeActionsSection({
  copyFeedback,
  onCopyThemeBundle,
  onRollbackLastSkin,
  onRestoreDefaultTheme
}: RoomThemeActionsSectionProps) {
  const { t } = useI18n();

  return (
    <section className="theme-studio-section room-theme-actions-section">
      <div className="theme-studio-section-head">
        <div>
          <h3>{t('room.settings.actions.title')}</h3>
        </div>
      </div>
      <div className="theme-summary-actions">
        <button type="button" className="btn-secondary compact-btn room-theme-action-button" onClick={onCopyThemeBundle}>
          <Icon name="copy" size={14} />
          <span>{copyFeedback === 'done' ? t('room.settings.actions.copyDone') : copyFeedback === 'failed' ? t('room.settings.actions.copyFailed') : t('room.settings.actions.copyCurrent')}</span>
        </button>
        <button type="button" className="btn-secondary compact-btn room-theme-action-button" onClick={onRollbackLastSkin}>
          <Icon name="refresh" size={14} />
          <span>{t('room.settings.actions.rollback')}</span>
        </button>
        <button type="button" className="btn-secondary compact-btn room-theme-action-button" onClick={onRestoreDefaultTheme}>
          <Icon name="sun" size={14} />
          <span>{t('room.settings.actions.restoreDefault')}</span>
        </button>
      </div>
    </section>
  );
}
