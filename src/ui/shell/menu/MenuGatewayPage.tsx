import { useEffect, useState } from 'react';
import {
  getDefaultProviderPath
} from '../../../engines/providerProtocol';
import type { ProviderProtocolLabelKey } from '../../../engines/providerProtocol';
import type { ProviderRouteLabelKey } from '../../../engines/provider-runtime';
import type { ProviderProfile } from '../../../types/domain';
import {
  getLocalizedProviderProtocolLabel,
  localizeProviderRouteLabel,
  useI18n
} from '../../../i18n';
import { Icon } from '../../Icon';
import { getProviderModelDisplayLabel, isBuiltInProviderDisplay } from '../apiProviderDisplay';

type MenuGatewayPageProps = {
  api: ProviderProfile;
  providerRouteLabelKey: ProviderRouteLabelKey;
  providerProtocolLabelKey: ProviderProtocolLabelKey;
  onBack: () => void;
  onOpenApi: () => void;
  onCreateGatewayProvider: () => void;
  onSetApiConfig: (patch: Partial<ProviderProfile>) => void;
};

export function MenuGatewayPage({
  api,
  providerRouteLabelKey,
  providerProtocolLabelKey,
  onBack,
  onOpenApi,
  onCreateGatewayProvider,
  onSetApiConfig
}: MenuGatewayPageProps) {
  const { t } = useI18n();
  const shouldOpenAdvanced = api.protocol !== 'openai-completions' || api.path !== getDefaultProviderPath(api.protocol);
  const [advancedOpen, setAdvancedOpen] = useState(() => (
    shouldOpenAdvanced
  ));
  const interfacePath = api.path || getDefaultProviderPath(api.protocol);
  const builtInProvider = isBuiltInProviderDisplay(api);
  const modelLabel = getProviderModelDisplayLabel(api, t('settings.gateway.emptyModel'));
  const protocolLabel = getLocalizedProviderProtocolLabel(api.protocol, t);
  const localizedProviderRouteLabel = localizeProviderRouteLabel(providerRouteLabelKey, providerProtocolLabelKey, t);

  useEffect(() => {
    setAdvancedOpen(shouldOpenAdvanced);
  }, [api.id]);

  useEffect(() => {
    if (shouldOpenAdvanced) {
      setAdvancedOpen(true);
    }
  }, [shouldOpenAdvanced]);

  return (
    <div className="menu-sheet-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.serviceSection')}</small>
          <h2>{t('settings.gateway.title')}</h2>
        </div>
      </div>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">{t('settings.gateway.currentSection')}</span>
        </div>
        <div className="provider-health-note menu-provider-health-note">
          <strong>{localizedProviderRouteLabel}</strong>
          <span>{api.baseUrl || t('settings.gateway.emptyBaseUrl')}</span>
        </div>
        <div className="settings-note">
          {t('settings.gateway.currentNote', {
            model: modelLabel,
            protocol: protocolLabel,
            path: api.path || t('settings.gateway.emptyModel')
          })}
        </div>
        <div className="settings-note">
          {t('settings.gateway.routeNote')}
        </div>
        <div className="provider-inline-actions menu-inline-actions-stack">
          <button type="button" className="btn-secondary" onClick={onCreateGatewayProvider}>
            {t('settings.gateway.copyCurrent')}
          </button>
          <button type="button" className="btn-secondary" onClick={onOpenApi}>
            {t('settings.gateway.moreApi')}
          </button>
        </div>
      </section>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">{t('settings.gateway.configSection')}</span>
        </div>
        <div className="settings-form">
          <label>{t('settings.gateway.nameLabel')}</label>
          <input
            value={api.name}
            onChange={(event) => onSetApiConfig({ name: event.target.value })}
            placeholder={t('settings.gateway.namePlaceholder')}
          />
          <label>{t('settings.gateway.baseUrlLabel')}</label>
          <input
            value={api.baseUrl}
            onChange={(event) => onSetApiConfig({ baseUrl: event.target.value })}
            placeholder="https://your-gateway.example/v1"
          />
          <label>{t('settings.gateway.apiKeyLabel')}</label>
          <input
            value={api.apiKey}
            onChange={(event) => onSetApiConfig({ apiKey: event.target.value })}
            placeholder="sk-... / relay token"
            type="password"
          />
          <label>{t('settings.gateway.modelLabel')}</label>
          <input
            value={builtInProvider ? modelLabel : api.model}
            onChange={(event) => onSetApiConfig({ model: event.target.value })}
            placeholder={builtInProvider ? t('settings.gateway.builtInRoute') : t('settings.gateway.modelPlaceholder')}
            disabled={builtInProvider}
          />
        </div>
        <div className="provider-health-note api-provider-connection-note">
          <strong>{t('settings.gateway.formatNoteTitle')}</strong>
          <span>{protocolLabel} · {interfacePath}</span>
        </div>
        <button
          type="button"
          className="btn-secondary compact api-provider-advanced-toggle"
          onClick={() => setAdvancedOpen((prev) => !prev)}
        >
          {advancedOpen ? t('settings.gateway.collapseAdvanced') : t('settings.gateway.expandAdvanced')}
        </button>
        {advancedOpen ? (
          <div className="settings-form api-provider-advanced-panel">
            <label>{t('settings.gateway.protocolLabel')}</label>
            <select
              value={api.protocol}
              onChange={(event) => {
                const protocol = event.target.value as ProviderProfile['protocol'];
                onSetApiConfig({
                  protocol,
                  path: getDefaultProviderPath(protocol)
                });
              }}
            >
              <option value="openai-completions">{getLocalizedProviderProtocolLabel('openai-completions', t)}</option>
              <option value="anthropic-messages">{getLocalizedProviderProtocolLabel('anthropic-messages', t)}</option>
              <option value="openai-responses">{getLocalizedProviderProtocolLabel('openai-responses', t)}</option>
              <option value="gemini-generate-content">{getLocalizedProviderProtocolLabel('gemini-generate-content', t)}</option>
            </select>
            <label>{t('settings.gateway.pathLabel')}</label>
            <input
              value={api.path}
              onChange={(event) => onSetApiConfig({ path: event.target.value })}
              placeholder="/chat/completions"
            />
          </div>
        ) : null}
      </section>

    </div>
  );
}
