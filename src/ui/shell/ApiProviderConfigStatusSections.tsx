import { ApiStreamDebugCard } from './ApiStreamDebugCard';
import { useI18n } from '../../i18n/useI18n';
import type { ApiTestResult } from './ApiProviderConfigShared';

type ApiProviderSummarySectionProps = {
  apiTesting: boolean;
  apiTestResult: ApiTestResult;
  onRunApiTest: () => Promise<void>;
};

export function ApiProviderSummarySection({
  apiTesting,
  apiTestResult,
  onRunApiTest
}: ApiProviderSummarySectionProps) {
  const { t } = useI18n();

  return (
    <section className="api-provider-section api-provider-section-secondary api-provider-section-test">
      <div className="api-provider-section-head">
        <span className="api-provider-section-kicker">{t('apiProvider.summary.kicker')}</span>
        <h3>{t('apiProvider.summary.title')}</h3>
        <p>{t('apiProvider.summary.detail')}</p>
      </div>
      <div className="api-test-row api-provider-test-row">
        <button
          type="button"
          className="btn-secondary compact api-provider-test-button"
          onClick={() => { void onRunApiTest(); }}
          disabled={apiTesting}
        >
          {apiTesting ? t('apiProvider.summary.testing') : t('apiProvider.summary.test')}
        </button>
        {apiTestResult ? (
          <div className={`api-test-result ${apiTestResult.ok ? 'ok' : 'bad'}`}>
            {apiTestResult.ok ? t('apiProvider.summary.ok') : t('apiProvider.summary.bad')} · {apiTestResult.message}
          </div>
        ) : (
          <div className="api-test-result">{t('apiProvider.summary.idle')}</div>
        )}
      </div>
    </section>
  );
}

export function ApiProviderDiagnosticsSection() {
  const { t } = useI18n();

  return (
    <section className="api-provider-section api-provider-section-secondary api-provider-section-diagnostics">
      <div className="api-provider-section-head">
        <span className="api-provider-section-kicker">{t('apiProvider.diagnostics.kicker')}</span>
        <h3>{t('apiProvider.diagnostics.title')}</h3>
        <p>{t('apiProvider.diagnostics.detail')}</p>
      </div>
      <ApiStreamDebugCard />
    </section>
  );
}
