import type { Persona, ProviderProfile } from '../types/domain';

export type PersonaProviderBinding = {
  api: ProviderProfile;
  fixedProvider: ProviderProfile | null;
  fixedProviderId: string | null;
  modelOverride: string;
  modelId: string;
};

export function resolvePersonaProviderBinding(args: {
  globalApi: ProviderProfile;
  providers: ProviderProfile[];
  persona?: Persona | null;
}): PersonaProviderBinding {
  const fixedProviderId = args.persona?.advanced?.providerId?.trim() || null;
  const fixedProvider = fixedProviderId
    ? args.providers.find((provider) => provider.id === fixedProviderId) ?? null
    : null;
  const baseApi = fixedProvider ?? args.globalApi;
  const modelOverride = fixedProviderId && !fixedProvider
    ? ''
    : args.persona?.advanced?.modelOverride.trim() || '';
  const modelId = modelOverride || baseApi.model;
  const api = modelId && modelId !== baseApi.model
    ? { ...baseApi, model: modelId }
    : baseApi;

  return {
    api,
    fixedProvider,
    fixedProviderId,
    modelOverride,
    modelId
  };
}
