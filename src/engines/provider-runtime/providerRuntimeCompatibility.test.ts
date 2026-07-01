import { afterEach, describe, expect, it } from 'vitest';
import type { ProviderProfile } from '../../types/domain';
import {
  clearProviderRuntimeCompatibilityCache,
  EMPTY_PROVIDER_RUNTIME_COMPATIBILITY_STATE,
  recordProviderRuntimeCompatibilityDegradation,
  resolveProviderRuntimeCompatibilityState,
  resolveProviderRuntimeCompatibilityToolHistoryMode
} from './providerRuntimeCompatibility';

function createProvider(overrides: Partial<ProviderProfile> = {}): ProviderProfile {
  return {
    id: 'provider-1',
    name: 'Test Provider',
    protocol: 'openai-completions',
    baseUrl: 'https://relay.example.test/v1',
    path: '/chat/completions',
    apiKey: 'test-key',
    model: 'model-a',
    capabilities: {
      images: false,
      streaming: true,
      thinking: false
    },
    ...overrides
  };
}

describe('provider runtime compatibility state', () => {
  afterEach(() => {
    clearProviderRuntimeCompatibilityCache();
  });

  it('records route-scoped native tool degradation without changing other routes', () => {
    const provider = createProvider();

    recordProviderRuntimeCompatibilityDegradation(provider, {
      reason: 'native_tools_rejected',
      disableNativeTools: true
    });

    expect(resolveProviderRuntimeCompatibilityState(provider)).toEqual({
      disableNativeTools: true,
      forceTranscriptMessages: false
    });
    expect(resolveProviderRuntimeCompatibilityState(createProvider({ model: 'model-b' }))).toEqual(
      EMPTY_PROVIDER_RUNTIME_COMPATIBILITY_STATE
    );
  });

  it('merges independent degradation facts for the same route', () => {
    const provider = createProvider();

    recordProviderRuntimeCompatibilityDegradation(provider, {
      reason: 'native_tools_rejected',
      disableNativeTools: true
    });
    recordProviderRuntimeCompatibilityDegradation(provider, {
      reason: 'message_roles_rejected',
      forceTranscriptMessages: true
    });

    const state = resolveProviderRuntimeCompatibilityState(provider);
    expect(state).toEqual({
      disableNativeTools: true,
      forceTranscriptMessages: true
    });
    expect(resolveProviderRuntimeCompatibilityToolHistoryMode('native', state)).toBe('transcript');
  });
});
