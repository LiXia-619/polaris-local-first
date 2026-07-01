import type { SkinSnapshot } from '../../../types/domain';
import { useI18n } from '../../../i18n/useI18n';

type ThemeHistorySectionProps = {
  skinHistory: SkinSnapshot[];
  onRestoreSkinSnapshot: (snapshotId: string) => void;
};

export function ThemeHistorySection({
  skinHistory,
  onRestoreSkinSnapshot
}: ThemeHistorySectionProps) {
  const { t, language } = useI18n();
  const dateFormatter = new Intl.DateTimeFormat(language, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <section className="theme-studio-section">
      <div className="theme-studio-section-head">
        <div>
          <h3>{t('theme.history.title')}</h3>
        </div>
      </div>
      <div className="theme-history-list">
        {skinHistory.length === 0 && <div className="theme-empty-card">{t('theme.history.empty')}</div>}
        {skinHistory.map((snapshot) => (
          <div key={snapshot.id} className="theme-history-item">
            <div className="theme-history-copy">
              <strong>{snapshot.label}</strong>
              <span>{dateFormatter.format(snapshot.createdAt)}</span>
            </div>
            <button type="button" className="theme-inline-action" onClick={() => onRestoreSkinSnapshot(snapshot.id)}>
              {t('theme.history.restore')}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
