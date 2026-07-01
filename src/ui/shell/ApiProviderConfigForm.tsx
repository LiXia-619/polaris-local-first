import { useEffect, useRef, useState } from 'react';
import { resolveProviderCapability } from '../../engines/provider-runtime';
import {
  discoverProviderModels,
  type ProviderModelOption
} from '../../engines/providerModelDiscovery';
import { useI18n } from '../../i18n/useI18n';
import { ApiProviderConnectionSection } from './ApiProviderConnectionSection';
import {
  ApiProviderCapabilitiesSection,
  ApiProviderImageUnderstandingSection,
  ApiProviderModelSection
} from './ApiProviderConfigEditableSections';
import {
  ApiProviderConfigFormProps,
  resolveApiProviderFormViewModel,
  shouldOpenAdvancedSettings
} from './ApiProviderConfigShared';
import {
  ApiProviderDiagnosticsSection,
  ApiProviderSummarySection
} from './ApiProviderConfigStatusSections';

export function ApiProviderConfigForm({
  api,
  providers,
  modelPickerOpen,
  apiTesting,
  apiTestResult,
  onSetApiConfig,
  onToggleModelPicker,
  onRunApiTest
}: ApiProviderConfigFormProps) {
  const { t } = useI18n();
  const publicTrialProvider = resolveProviderCapability(api).route.isBuiltInTrial;
  const builtInProvider = publicTrialProvider;
  const {
    matchedPreset,
    interfacePath
  } = resolveApiProviderFormViewModel(api);
  const [selectedPresetId, setSelectedPresetId] = useState(matchedPreset?.id ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(() => shouldOpenAdvancedSettings(api, matchedPreset?.id));
  const discoveryRequestIdRef = useRef(0);
  const [modelDiscovery, setModelDiscovery] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    models: ProviderModelOption[];
    error: string | null;
  }>({
    status: 'idle',
    models: [],
    error: null
  });
  const presetModels = publicTrialProvider ? [] : (matchedPreset?.models ?? []);

  useEffect(() => {
    setSelectedPresetId(matchedPreset?.id ?? '');
    setAdvancedOpen(shouldOpenAdvancedSettings(api, matchedPreset?.id));
  }, [api.id]);

  useEffect(() => {
    if (!selectedPresetId) return;
    const nextPresetId = matchedPreset?.id ?? '';
    if (nextPresetId !== selectedPresetId) {
      setSelectedPresetId(nextPresetId);
    }
  }, [matchedPreset?.id, selectedPresetId]);

  useEffect(() => {
    if (shouldOpenAdvancedSettings(api, matchedPreset?.id)) {
      setAdvancedOpen(true);
    }
  }, [api.path, api.protocol, matchedPreset?.id]);

  useEffect(() => {
    discoveryRequestIdRef.current += 1;
    setModelDiscovery({
      status: 'idle',
      models: [],
      error: null
    });
  }, [api.id, api.baseUrl, api.protocol]);

  function formatModelDiscoveryError(error: string, hasPresetFallback: boolean) {
    if (hasPresetFallback) {
      return t('apiProvider.model.errorPresetFallback');
    }
    if (error.includes('不是 JSON') || error.includes('没有返回可用模型')) {
      return t('apiProvider.model.errorManualOnly');
    }
    return t('apiProvider.model.errorManualSuffix', { error });
  }

  async function handleDiscoverModels() {
    const requestId = discoveryRequestIdRef.current + 1;
    discoveryRequestIdRef.current = requestId;
    setModelDiscovery({
      status: 'loading',
      models: [],
      error: null
    });

    const result = await discoverProviderModels({ api });
    if (discoveryRequestIdRef.current !== requestId) return;

    if (result.ok) {
      setModelDiscovery({
        status: 'success',
        models: result.models,
        error: null
      });
      if (!modelPickerOpen) {
        onToggleModelPicker();
      }
      return;
    }

    const hasPresetFallback = presetModels.length > 0;
    setModelDiscovery({
      status: 'error',
      models: [],
      error: formatModelDiscoveryError(result.error, hasPresetFallback)
    });
    if (hasPresetFallback && !modelPickerOpen) {
      onToggleModelPicker();
    }
  }

  function handleModelPickerAction() {
    if (modelPickerOpen) {
      onToggleModelPicker();
      return;
    }
    if (
      modelDiscovery.models.length > 0
      || (
        presetModels.length > 0
        && (!api.baseUrl.trim() || !api.apiKey.trim() || modelDiscovery.status === 'error')
      )
    ) {
      onToggleModelPicker();
      return;
    }
    void handleDiscoverModels();
  }

  return (
    <div className="api-provider-console">
      {!builtInProvider ? (
        <ApiProviderConnectionSection
          api={api}
          matchedPresetName={matchedPreset ? t('apiProvider.connection.presetAdopted', { name: matchedPreset.name }) : ''}
          selectedPresetId={selectedPresetId}
          advancedOpen={advancedOpen}
          interfacePath={interfacePath}
          onSetSelectedPresetId={setSelectedPresetId}
          onSetAdvancedOpen={setAdvancedOpen}
          onSetApiConfig={onSetApiConfig}
        />
      ) : null}

      <ApiProviderModelSection
        api={api}
        modelPickerOpen={modelPickerOpen}
        presetModels={presetModels}
        discoveredModels={modelDiscovery.models}
        modelDiscoveryStatus={modelDiscovery.status}
        modelDiscoveryError={modelDiscovery.error}
        onSetApiConfig={onSetApiConfig}
        onOpenModelPicker={handleModelPickerAction}
      />

      <ApiProviderSummarySection
        apiTesting={apiTesting}
        apiTestResult={apiTestResult}
        onRunApiTest={onRunApiTest}
      />

      {!builtInProvider ? (
        <ApiProviderCapabilitiesSection
          api={api}
          onSetApiConfig={onSetApiConfig}
        />
      ) : null}

      {!builtInProvider ? (
        <ApiProviderImageUnderstandingSection
          api={api}
          providers={providers}
          onSetApiConfig={onSetApiConfig}
        />
      ) : null}

      <ApiProviderDiagnosticsSection />
    </div>
  );
}
