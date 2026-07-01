import { findProviderPreset } from '../../config/catalog/providerCatalog';
import { getDefaultProviderPath } from '../../engines/providerProtocol';
import type { ProviderProfile } from '../../types/domain';

export type ApiTestResult = null | { ok: boolean; message: string };

export type ApiProviderConfigFormProps = {
  api: ProviderProfile;
  providers: ProviderProfile[];
  modelPickerOpen: boolean;
  apiTesting: boolean;
  apiTestResult: ApiTestResult;
  onSetApiConfig: (patch: Partial<ProviderProfile>) => void;
  onToggleModelPicker: () => void;
  onRunApiTest: () => Promise<void>;
};

export function shouldOpenAdvancedSettings(api: ProviderProfile, matchedPresetId?: string) {
  if (api.path.trim() !== getDefaultProviderPath(api.protocol)) return true;
  if (!matchedPresetId && api.protocol !== 'openai-completions') return true;
  return false;
}

export function resolveApiProviderFormViewModel(api: ProviderProfile) {
  const matchedPreset = findProviderPreset(api.baseUrl, api.path);

  return {
    matchedPreset,
    interfacePath: api.path || getDefaultProviderPath(api.protocol)
  };
}
