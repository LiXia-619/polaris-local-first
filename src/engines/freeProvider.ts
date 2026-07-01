import { createUid } from './id';
import type { ProviderProfile } from '../types/domain';
export const POLARIS_PUBLIC_PROVIDER_ID = 'provider-polaris-public';
export const POLARIS_PUBLIC_PROVIDER_KEY = 'polaris-public-free';
export const POLARIS_PUBLIC_PROVIDER_MODEL = 'Polaris';
export const POLARIS_PUBLIC_PROVIDER_MODELS = [
  POLARIS_PUBLIC_PROVIDER_MODEL,
  'openai/gpt-oss-120b:free',
  'openrouter/free'
] as const;

export const POLARIS_PUBLIC_PROVIDER: ProviderProfile = {
  id: POLARIS_PUBLIC_PROVIDER_ID,
  name: 'Polaris',
  protocol: 'openai-completions',
  baseUrl: '/api',
  path: '/chat/completions',
  apiKey: POLARIS_PUBLIC_PROVIDER_KEY,
  model: POLARIS_PUBLIC_PROVIDER_MODELS[0],
  capabilities: {
    images: false,
    streaming: true,
    thinking: false
  }
};

const LEGACY_POLARIS_FREE_PROVIDER_ID = 'provider-polaris-free';
const LEGACY_POLARIS_FREE_PROVIDER_KEY = 'polaris-free';
const DEVICE_ID_KEY = 'polaris-device-id-v1';

export type PolarisBuiltInProviderKind = 'public';

function matchesProviderRoute(
  provider: Pick<ProviderProfile, 'baseUrl' | 'path' | 'apiKey'>,
  target: Pick<ProviderProfile, 'baseUrl' | 'path' | 'apiKey'>
) {
  return (
    provider.baseUrl.trim() === target.baseUrl &&
    provider.path.trim() === target.path &&
    provider.apiKey.trim() === target.apiKey
  );
}

function isLegacyPolarisPublicProvider(provider: Pick<ProviderProfile, 'id' | 'apiKey' | 'baseUrl' | 'path'>) {
  return (
    provider.id === LEGACY_POLARIS_FREE_PROVIDER_ID ||
    (
      provider.baseUrl.trim() === '/api' &&
      provider.path.trim() === '/chat/completions' &&
      provider.apiKey.trim() === LEGACY_POLARIS_FREE_PROVIDER_KEY
    )
  );
}

export function getPolarisBuiltInProviderKind(
  provider: Pick<ProviderProfile, 'id' | 'apiKey' | 'baseUrl' | 'path'>
): PolarisBuiltInProviderKind | null {
  if (provider.id === POLARIS_PUBLIC_PROVIDER_ID || matchesProviderRoute(provider, POLARIS_PUBLIC_PROVIDER) || isLegacyPolarisPublicProvider(provider)) {
    return 'public';
  }

  return null;
}

export function isPolarisBuiltInProvider(provider: Pick<ProviderProfile, 'id' | 'apiKey' | 'baseUrl' | 'path'>) {
  return getPolarisBuiltInProviderKind(provider) !== null;
}

export function isPolarisPublicProvider(provider: Pick<ProviderProfile, 'id' | 'apiKey' | 'baseUrl' | 'path'>) {
  return getPolarisBuiltInProviderKind(provider) === 'public';
}

function normalizeBuiltInProviderModel<ModelName extends string>(
  provider: ProviderProfile,
  providerModels: readonly ModelName[],
  override?: Partial<ProviderProfile> | null
) {
  const requestedModel = override?.model?.trim();
  const model = requestedModel && providerModels.includes(requestedModel as ModelName)
    ? requestedModel
    : provider.model;

  return {
    ...provider,
    model
  };
}

export function normalizePolarisPublicProvider(provider?: Partial<ProviderProfile> | null): ProviderProfile {
  return normalizeBuiltInProviderModel(POLARIS_PUBLIC_PROVIDER, POLARIS_PUBLIC_PROVIDER_MODELS, provider);
}

export function getPolarisDeviceId() {
  if (typeof window === 'undefined') {
    return 'polaris-device-server';
  }

  const cached = window.localStorage.getItem(DEVICE_ID_KEY)?.trim();
  if (cached) {
    return cached;
  }

  const nextId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : createUid('device');
  window.localStorage.setItem(DEVICE_ID_KEY, nextId);
  return nextId;
}
