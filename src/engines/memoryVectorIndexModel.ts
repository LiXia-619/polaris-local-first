import type { MemoryVectorRetrievalSettings, ProviderProfile } from '../types/domain';
import type { MemoryVectorIndexModelIdentity } from './memoryVectorIndexStorage';

export type MemoryVectorModelSettings = Pick<
  MemoryVectorRetrievalSettings,
  'enabled' | 'baseUrl' | 'path' | 'apiKey' | 'model' | 'dimensions'
>;

function normalizeDimensions(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function buildMemoryVectorProviderId(settings: MemoryVectorModelSettings) {
  return `memory-vector:${settings.baseUrl?.trim() ?? ''}:${settings.path?.trim() || '/embeddings'}`;
}

export function selectMemoryVectorIndexProvider(args: {
  settings: MemoryVectorModelSettings;
  providers: ProviderProfile[];
  globalApi: ProviderProfile;
}) {
  const baseUrl = args.settings.baseUrl?.trim();
  const model = args.settings.model?.trim();
  if (args.settings.enabled !== true || !baseUrl || !model) return null;

  return {
    id: buildMemoryVectorProviderId(args.settings),
    name: '向量模型',
    protocol: 'openai-completions',
    baseUrl,
    path: args.settings.path?.trim() || '/embeddings',
    apiKey: args.settings.apiKey?.trim() ?? '',
    model,
    capabilities: {
      images: false,
      streaming: false,
      thinking: false
    }
  } satisfies ProviderProfile;
}

export function resolveMemoryVectorIndexRuntimeModel(args: {
  settings: MemoryVectorModelSettings;
  providers: ProviderProfile[];
  globalApi: ProviderProfile;
}): MemoryVectorIndexModelIdentity | null {
  const provider = selectMemoryVectorIndexProvider(args);
  if (!provider) return null;
  const model = args.settings.model?.trim();
  if (!provider.id.trim() || !model) return null;
  return {
    providerId: provider.id,
    model,
    dimensions: normalizeDimensions(args.settings.dimensions)
  };
}
