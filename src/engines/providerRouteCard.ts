import { findProviderPreset } from '../config/catalog/providerCatalog';
import { inferProviderProtocol } from './providerProtocol';
import type { ProviderCapabilities, ProviderProfile, ProviderProtocol } from '../types/domain';

export type ProviderRouteCard = {
  type: 'polaris-provider-card';
  version: 1;
  name?: string;
  protocol?: ProviderProtocol;
  baseUrl: string;
  path: string;
  model: string;
  apiKey?: string;
  capabilities?: Partial<ProviderCapabilities>;
};

type ParsedProviderRouteCard = Omit<ProviderProfile, 'id'>;

function normalizeCapabilities(
  capabilities: Partial<ProviderCapabilities> | undefined,
  fallback: ProviderCapabilities
): ProviderCapabilities {
  return {
    images: capabilities?.images ?? fallback.images,
    streaming: capabilities?.streaming ?? fallback.streaming,
    thinking: capabilities?.thinking ?? fallback.thinking
  };
}

function resolvePresetFallback(baseUrl: string, path: string): ProviderCapabilities {
  return findProviderPreset(baseUrl, path)?.capabilities ?? {
    images: false,
    streaming: true,
    thinking: false
  };
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} 不能为空`);
  }

  return value.trim();
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRouteCardObject(raw: Record<string, unknown>): ParsedProviderRouteCard {
  const baseUrl = readRequiredString(raw.baseUrl, '线路卡 baseUrl');
  const path = readRequiredString(raw.path, '线路卡 path');
  const model = readRequiredString(raw.model, '线路卡 model');
  const protocol = inferProviderProtocol({
    protocol: typeof raw.protocol === 'string' ? raw.protocol as ProviderProtocol : undefined,
    path
  });
  const preset = findProviderPreset(baseUrl, path);
  const fallbackCapabilities = resolvePresetFallback(baseUrl, path);

  return {
    name: readOptionalString(raw.name) || preset?.name || '导入线路',
    protocol: preset?.protocol ?? protocol,
    baseUrl,
    path,
    apiKey: readOptionalString(raw.apiKey),
    model,
    capabilities: normalizeCapabilities(
      raw.capabilities && typeof raw.capabilities === 'object' && !Array.isArray(raw.capabilities)
        ? raw.capabilities as Partial<ProviderCapabilities>
        : undefined,
      fallbackCapabilities
    )
  };
}

export function serializeProviderRouteCard(
  provider: Pick<ProviderProfile, 'name' | 'protocol' | 'baseUrl' | 'path' | 'apiKey' | 'model' | 'capabilities'>,
  options: { includeApiKey?: boolean } = {}
) {
  const routeCard: ProviderRouteCard = {
    type: 'polaris-provider-card',
    version: 1,
    name: provider.name.trim() || undefined,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl.trim(),
    path: provider.path.trim(),
    model: provider.model.trim(),
    capabilities: {
      images: provider.capabilities.images,
      streaming: provider.capabilities.streaming,
      thinking: provider.capabilities.thinking
    }
  };

  if (options.includeApiKey && provider.apiKey.trim()) {
    routeCard.apiKey = provider.apiKey.trim();
  }

  return JSON.stringify(routeCard, null, 2);
}

export function parseProviderRouteCard(input: string): ParsedProviderRouteCard {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('线路卡内容是空的');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('线路卡必须是 JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('线路卡必须是 JSON 对象');
  }

  const raw = parsed as Record<string, unknown>;
  const rawType = raw.type;
  if (rawType !== undefined && rawType !== 'polaris-provider-card') {
    throw new Error('这不是 Polaris 的线路卡');
  }

  const rawVersion = raw.version;
  if (rawVersion !== undefined && rawVersion !== 1) {
    throw new Error('这张线路卡版本太新，当前 Polaris 还不认识');
  }

  return normalizeRouteCardObject(raw);
}
