import type { ConversationSummaryModelSettings, MemoryVectorRetrievalSettings, ProviderProfile } from '../../../types/domain';
import { type I18nTranslator, useI18n } from '../../../i18n';
import { HelpHint } from '../../HelpHint';
import { Icon } from '../../Icon';

type MenuMemoryPageProps = {
  conversationSummaryModel: ConversationSummaryModelSettings;
  memoryVectorRetrieval: MemoryVectorRetrievalSettings;
  providers: ProviderProfile[];
  onBack: () => void;
  onSetConversationSummaryModel: (patch: Partial<ConversationSummaryModelSettings>) => void;
  onSetMemoryVectorRetrieval: (patch: Partial<MemoryVectorRetrievalSettings>) => void;
};

function formatConversationSummaryUpdatedAt(timestamp: number, language: I18nTranslator['language']) {
  return new Date(timestamp).toLocaleString(language, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getConversationSummaryAutoStatus(settings: ConversationSummaryModelSettings, i18n: I18nTranslator) {
  if (settings.autoUpdateEnabled) {
    return settings.lastUpdatedAt
      ? i18n.t('settings.memory.autoWithLast', { time: formatConversationSummaryUpdatedAt(settings.lastUpdatedAt, i18n.language) })
      : i18n.t('settings.memory.autoWaiting');
  }

  return settings.lastUpdatedAt
    ? i18n.t('settings.memory.manualWithLast', { time: formatConversationSummaryUpdatedAt(settings.lastUpdatedAt, i18n.language) })
    : i18n.t('settings.memory.manualIdle');
}

function ConversationSummaryModelSettingsPanel({
  settings,
  providers,
  onSetConversationSummaryModel
}: {
  settings: ConversationSummaryModelSettings;
  providers: ProviderProfile[];
  onSetConversationSummaryModel: (patch: Partial<ConversationSummaryModelSettings>) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const summaryStateLabel = settings.enabled ? t('settings.enabled') : t('settings.disabled');
  const autoStateLabel = settings.autoUpdateEnabled ? t('settings.enabled') : t('settings.disabled');
  const skipProcessedStateLabel = settings.skipProcessedSources !== false ? t('settings.enabled') : t('settings.disabled');

  return (
    <div className="memory-toggle memory-toggle--switch toolbox-toggle-row" data-checked={settings.enabled ? 'true' : 'false'}>
      <div className="toolbox-toggle-row-head">
        <div className="memory-toggle-copy toolbox-toggle-copy">
          <strong>
            <span className="toolbox-toggle-icon" aria-hidden="true">
              <Icon name="feather" size={13} />
            </span>
            {t('settings.memory.summaryTitle')}
          </strong>
          <span>{t('settings.memory.summaryDetail')}</span>
        </div>
        <button
          type="button"
          className={`ps-toggle-sw memory-toggle-switch ${settings.enabled ? 'ps-toggle-sw--on' : ''}`}
          aria-pressed={settings.enabled}
          aria-label={`${t('settings.memory.summaryTitle')} ${summaryStateLabel}`}
          onClick={() => onSetConversationSummaryModel({ enabled: !settings.enabled })}
        >
          <span className="ps-toggle-knob" />
        </button>
      </div>
      {settings.enabled ? (
        <div className="toolbox-inline-config">
          <div className="settings-form">
            <label>{t('settings.memory.providerLabel')}</label>
            <select
              value={settings.providerId ?? ''}
              onChange={(event) => onSetConversationSummaryModel({ providerId: event.target.value })}
            >
              <option value="">{t('settings.memory.followGlobalProvider')}</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.model}
                </option>
              ))}
            </select>
            <label>{t('settings.memory.modelLabel')}</label>
            <input
              value={settings.modelOverride ?? ''}
              onChange={(event) => onSetConversationSummaryModel({ modelOverride: event.target.value })}
              placeholder={t('settings.memory.modelPlaceholder')}
            />
            <label>{t('settings.memory.sourceCharsLabel')}</label>
            <input
              value={String(settings.targetSourceChars ?? '')}
              inputMode="numeric"
              onChange={(event) => {
                const value = Number(event.target.value);
                onSetConversationSummaryModel({
                  targetSourceChars: Number.isFinite(value) ? value : undefined
                });
              }}
              placeholder="50000"
            />
          </div>
          <div
            className="memory-toggle memory-toggle--switch toolbox-toggle-row"
            data-checked={settings.autoUpdateEnabled ? 'true' : 'false'}
          >
            <div className="toolbox-toggle-row-head">
              <div className="memory-toggle-copy toolbox-toggle-copy">
                <strong>
                  <span className="toolbox-toggle-icon" aria-hidden="true">
                    <Icon name="refresh" size={13} />
                  </span>
                  {t('settings.memory.autoTitle')}
                </strong>
                <span>{t('settings.memory.autoDetail')}</span>
              </div>
              <button
                type="button"
                className={`ps-toggle-sw memory-toggle-switch ${settings.autoUpdateEnabled ? 'ps-toggle-sw--on' : ''}`}
                aria-pressed={settings.autoUpdateEnabled === true}
                aria-label={`${t('settings.memory.autoTitle')} ${autoStateLabel}`}
                onClick={() => onSetConversationSummaryModel({ autoUpdateEnabled: !settings.autoUpdateEnabled })}
              >
                <span className="ps-toggle-knob" />
              </button>
            </div>
          </div>
          <div
            className="memory-toggle memory-toggle--switch toolbox-toggle-row"
            data-checked={settings.skipProcessedSources !== false ? 'true' : 'false'}
          >
            <div className="toolbox-toggle-row-head">
              <div className="memory-toggle-copy toolbox-toggle-copy">
                <strong>
                  <span className="toolbox-toggle-icon" aria-hidden="true">
                    <Icon name="check" size={13} />
                  </span>
                  {t('settings.memory.skipProcessedTitle')}
                </strong>
                <span>{t('settings.memory.skipProcessedDetail')}</span>
              </div>
              <button
                type="button"
                className={`ps-toggle-sw memory-toggle-switch ${settings.skipProcessedSources !== false ? 'ps-toggle-sw--on' : ''}`}
                aria-pressed={settings.skipProcessedSources !== false}
                aria-label={`${t('settings.memory.skipProcessedTitle')} ${skipProcessedStateLabel}`}
                onClick={() => onSetConversationSummaryModel({ skipProcessedSources: settings.skipProcessedSources === false })}
              >
                <span className="ps-toggle-knob" />
              </button>
            </div>
          </div>
          <div className="memory-vector-index-progress" aria-label={t('settings.memory.statusLabel')}>
            <div className="memory-vector-index-progress-copy">
              <span>{getConversationSummaryAutoStatus(settings, i18n)}</span>
              <span>{t('settings.memory.bodyHidden')}</span>
            </div>
            <div className="memory-vector-index-meta">
              <span>{settings.enabled ? t('settings.memory.summaryEnabled') : t('settings.memory.summaryDisabled')}</span>
              <span>{settings.autoUpdateEnabled ? t('settings.memory.autoIdle') : t('settings.memory.manualMode')}</span>
              <span>{settings.skipProcessedSources !== false ? t('settings.memory.skipProcessedOn') : t('settings.memory.skipProcessedOff')}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MenuMemoryPage({
  conversationSummaryModel,
  providers,
  onBack,
  onSetConversationSummaryModel
}: MenuMemoryPageProps) {
  const { t } = useI18n();

  return (
    <div className="menu-sheet-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <h2>{t('settings.memory.title')}</h2>
        </div>
      </div>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker menu-section-kicker-row">
            {t('settings.memory.crossChatSection')}
            <HelpHint
              label={t('settings.memory.crossChatSection')}
              text={t('settings.memory.crossChatHelp')}
            />
          </span>
          <p className="menu-section-note">{t('settings.memory.noteGeneration')}</p>
          <p className="menu-section-note">{t('settings.memory.noteVector')}</p>
        </div>
        <div className="memory-toggle-grid">
          <ConversationSummaryModelSettingsPanel
            settings={conversationSummaryModel}
            providers={providers}
            onSetConversationSummaryModel={onSetConversationSummaryModel}
          />
        </div>
      </section>
    </div>
  );
}
