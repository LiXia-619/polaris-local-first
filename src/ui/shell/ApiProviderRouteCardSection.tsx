import { useEffect, useState } from 'react';
import { resolveProviderCapability } from '../../engines/provider-runtime';
import { parseProviderRouteCard, serializeProviderRouteCard } from '../../engines/providerRouteCard';
import { useI18n } from '../../i18n/useI18n';
import { writeTextToClipboard } from '../../infrastructure/clipboard';
import type { ProviderProfile } from '../../types/domain';
import { HelpHint } from '../HelpHint';

type ApiProviderRouteCardSectionProps = {
  api: ProviderProfile;
  onImportProvider: (provider: Partial<ProviderProfile>) => void;
  onImported?: () => void;
};

async function readRouteCardTextFromClipboard() {
  if (!navigator.clipboard?.readText) return '';

  try {
    return (await navigator.clipboard.readText()).trim();
  } catch {
    return '';
  }
}

export function ApiProviderRouteCardSection({
  api,
  onImportProvider,
  onImported
}: ApiProviderRouteCardSectionProps) {
  const { t } = useI18n();
  const freeProvider = resolveProviderCapability(api).route.isBuiltInTrial;
  const [busyAction, setBusyAction] = useState<null | 'copy' | 'import'>(null);
  const [feedback, setFeedback] = useState(
    freeProvider
      ? ''
      : t('apiProvider.routeCard.defaultFeedback')
  );

  useEffect(() => {
    setFeedback(
      freeProvider
        ? ''
        : t('apiProvider.routeCard.defaultFeedback')
    );
  }, [api.id, freeProvider, t]);

  const copyRouteCard = async () => {
    if (freeProvider) return;

    const routeCard = serializeProviderRouteCard(api);
    setBusyAction('copy');
    try {
      await writeTextToClipboard(routeCard);
      setFeedback(t('apiProvider.routeCard.copySuccess'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('apiProvider.routeCard.copyFailure');
      setFeedback(message);
      window.alert(message);
    } finally {
      setBusyAction(null);
    }
  };

  const importRouteCard = async () => {
    setBusyAction('import');
    try {
      const clipboardText = await readRouteCardTextFromClipboard();
      const manualText = clipboardText || window.prompt(t('apiProvider.routeCard.prompt'), '') || '';
      const routeCardText = manualText.trim();
      if (!routeCardText) {
        setFeedback(t('apiProvider.routeCard.emptyImport'));
        return;
      }

      const importedProvider = parseProviderRouteCard(routeCardText);
      onImportProvider(importedProvider);
      onImported?.();
      const successMessage =
        importedProvider.apiKey
          ? t('apiProvider.routeCard.importSuccess', { name: importedProvider.name ?? '' })
          : t('apiProvider.routeCard.importSuccessNeedsKey', { name: importedProvider.name ?? '' });
      setFeedback(successMessage);
      window.alert(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('apiProvider.routeCard.importFailure');
      setFeedback(message);
      window.alert(message);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="api-provider-section api-provider-section-secondary">
      <div className="api-provider-section-head">
        <span className="api-provider-section-kicker">{t('apiProvider.routeCard.kicker')}</span>
        <h3>
          {t('apiProvider.routeCard.title')}
          <HelpHint
            className="help-hint--inline-title help-hint--below"
            label={t('apiProvider.routeCard.helpLabel')}
            text={t('apiProvider.routeCard.helpText')}
          />
        </h3>
        {!freeProvider ? (
          <p>{t('apiProvider.routeCard.detail')}</p>
        ) : null}
      </div>
      <div className="api-provider-route-actions">
        {!freeProvider ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { void copyRouteCard(); }}
            disabled={busyAction !== null}
          >
            {busyAction === 'copy' ? t('apiProvider.routeCard.copying') : t('apiProvider.routeCard.copy')}
          </button>
        ) : null}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => { void importRouteCard(); }}
          disabled={busyAction !== null}
        >
          {busyAction === 'import' ? t('apiProvider.routeCard.importing') : t('apiProvider.routeCard.import')}
        </button>
      </div>
      {feedback ? (
        <div className="api-provider-route-feedback">
          {feedback}
        </div>
      ) : null}
    </section>
  );
}
