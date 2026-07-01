import { describe, expect, it } from 'vitest';
import { normalizePolarisPublicProvider } from '../freeProvider';
import { resolveCanonicalProviderCapabilities } from '../provider-runtime';
import { buildRequestTooling } from './requestPreparationAudit';
import type { ProviderProfile } from '../../types/domain';

function createProvider(overrides: Partial<ProviderProfile>): ProviderProfile {
  return {
    id: 'provider-test',
    name: 'Provider Test',
    apiKey: 'sk-test',
    protocol: 'openai-completions',
    baseUrl: 'https://api.openai.com/v1',
    path: '/chat/completions',
    model: 'gpt-5-mini',
    capabilities: {
      images: false,
      streaming: true,
      thinking: false
    },
    ...overrides
  };
}

describe('requestPreparationAudit tooling strategy', () => {
  it('keeps native-first protocol for the built-in free provider', () => {
    const api = normalizePolarisPublicProvider();
    const providerCapabilities = resolveCanonicalProviderCapabilities(api);

    expect(providerCapabilities.tools.promptProtocol).toBe('native-first');

    const result = buildRequestTooling({
      activeCard: null,
      visibleCards: [],
      toolEnforcementMode: 'force',
      enabledToolGroups: { room: true }
    }, providerCapabilities);

    expect(result.toolRequest.tools.length).toBeGreaterThan(0);
    expect(result.toolRequest.toolChoice).toBe('auto');
    expect(result.tooling.enabled).toBe(true);
  });

  it('keeps native-first protocol for proxy-compatible custom providers', () => {
    const api = createProvider({
      id: 'custom-mimo',
      name: 'Custom Mimo',
      apiKey: 'sk-test',
      baseUrl: 'https://apixiaomimimo.com/v1',
      path: '/chat/completions'
    });
    const providerCapabilities = resolveCanonicalProviderCapabilities(api);

    expect(providerCapabilities.tools.promptProtocol).toBe('native-first');

    const result = buildRequestTooling({
      activeCard: null,
      visibleCards: [],
      toolEnforcementMode: 'force',
      enabledToolGroups: { room: true }
    }, providerCapabilities);

    expect(result.toolRequest.tools.length).toBeGreaterThan(0);
    expect(result.toolRequest.toolChoice).toBe('auto');
    expect(result.tooling.enabled).toBe(true);
  });

  it('keeps native tools automatic for standard direct providers', () => {
    const api = createProvider({
      id: 'openai-direct',
      name: 'OpenAI Direct',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      path: '/chat/completions'
    });
    const providerCapabilities = resolveCanonicalProviderCapabilities(api);

    expect(providerCapabilities.tools.promptProtocol).toBe('native-first');

    const result = buildRequestTooling({
      activeCard: null,
      visibleCards: [],
      toolEnforcementMode: 'force',
      enabledToolGroups: { room: true }
    }, providerCapabilities);

    expect(result.toolRequest.tools.length).toBeGreaterThan(0);
    expect(result.toolRequest.toolChoice).toBe('auto');
    expect(result.tooling.enabled).toBe(true);
  });

  it('keeps native tools but omits unsupported tool choice for DeepSeek reasoner', () => {
    const api = createProvider({
      id: 'deepseek',
      name: 'DeepSeek',
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com/v1',
      path: '/chat/completions',
      model: 'deepseek-reasoner',
      capabilities: {
        images: false,
        streaming: true,
        thinking: true
      }
    });
    const providerCapabilities = resolveCanonicalProviderCapabilities(api);

    const result = buildRequestTooling({
      activeCard: null,
      visibleCards: [],
      toolEnforcementMode: 'force',
      enabledToolGroups: { theme: true }
    }, providerCapabilities);

    expect(result.toolRequest.tools.length).toBeGreaterThan(0);
    expect(result.toolRequest.toolChoice).toBeUndefined();
    expect(result.tooling.enabled).toBe(true);
    expect(result.tooling.toolChoice).toBeNull();
  });
});
