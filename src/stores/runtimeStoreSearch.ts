import type { WebSearchConfig, WebSearchCustomAdapter, WebSearchProviderType } from '../types/domain';

export const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  provider: 'bingLocal',
  apiKey: '',
  bochaSummary: true,
  bochaFreshness: 'noLimit',
  customEndpoint: '',
  customAdapter: 'tavily',
  customLabel: ''
};

const WEB_SEARCH_PROVIDERS = new Set<WebSearchProviderType>(['bingLocal', 'brave', 'bocha', 'tavily', 'custom']);
const WEB_SEARCH_CUSTOM_ADAPTERS = new Set<WebSearchCustomAdapter>(['brave', 'bocha', 'tavily']);

function normalizeSearchProvider(value: unknown): WebSearchProviderType {
  return WEB_SEARCH_PROVIDERS.has(value as WebSearchProviderType)
    ? value as WebSearchProviderType
    : DEFAULT_WEB_SEARCH_CONFIG.provider;
}

function normalizeBochaFreshness(value: unknown) {
  const freshness = typeof value === 'string' ? value.trim() : '';
  return freshness || DEFAULT_WEB_SEARCH_CONFIG.bochaFreshness;
}

function normalizeCustomAdapter(value: unknown): WebSearchCustomAdapter {
  return WEB_SEARCH_CUSTOM_ADAPTERS.has(value as WebSearchCustomAdapter)
    ? value as WebSearchCustomAdapter
    : DEFAULT_WEB_SEARCH_CONFIG.customAdapter;
}

export function normalizeWebSearchConfig(value?: Partial<WebSearchConfig> | null): WebSearchConfig {
  return {
    provider: normalizeSearchProvider(value?.provider),
    apiKey: typeof value?.apiKey === 'string' ? value.apiKey : '',
    bochaSummary: typeof value?.bochaSummary === 'boolean'
      ? value.bochaSummary
      : DEFAULT_WEB_SEARCH_CONFIG.bochaSummary,
    bochaFreshness: normalizeBochaFreshness(value?.bochaFreshness),
    customEndpoint: typeof value?.customEndpoint === 'string' ? value.customEndpoint.trim() : '',
    customAdapter: normalizeCustomAdapter(value?.customAdapter),
    customLabel: typeof value?.customLabel === 'string' ? value.customLabel.trim() : ''
  };
}

export function mergeWebSearchConfig(
  current: WebSearchConfig,
  patch: Partial<WebSearchConfig>
): WebSearchConfig {
  return normalizeWebSearchConfig({
    ...current,
    ...patch
  });
}
