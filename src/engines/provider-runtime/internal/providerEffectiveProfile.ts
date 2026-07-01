import type { ProviderProfile } from '../../../types/domain';
import { isMimoHost, isMimoModel, parseProviderHost } from './providerMatching';

const MIMO_IMAGE_MODELS = [
  'mimo-v2-omni'
] as const;

export function supportsMimoImages(model?: string | null) {
  const normalizedModel = model?.trim().toLowerCase();
  return Boolean(normalizedModel && MIMO_IMAGE_MODELS.includes(normalizedModel as (typeof MIMO_IMAGE_MODELS)[number]));
}

export function resolveProviderEffectiveModel(
  provider: Pick<ProviderProfile, 'model'>,
  modelOverride?: string | null
) {
  return modelOverride?.trim() || provider.model;
}

export function resolveProviderEffectiveCapabilities(
  provider: ProviderProfile,
  modelOverride?: string | null
) {
  const effectiveModel = resolveProviderEffectiveModel(provider, modelOverride);
  if (isMimoHost(parseProviderHost(provider.baseUrl)) && isMimoModel(effectiveModel)) {
    return {
      ...provider.capabilities,
      images: supportsMimoImages(effectiveModel)
    };
  }

  return provider.capabilities;
}
