import { Capacitor } from '@capacitor/core';
import { buildApiEndpoint, buildInternalApiEndpoint } from './chat-api/chatApiEndpoint';
import { isProviderEmbeddingRelayTarget } from './chat-api/providerEmbeddingRelayShared';
import type { ProviderProfile } from '../types/domain';

export type MemoryVectorEmbeddingRequest = {
  api: ProviderProfile;
  model: string;
  dimensions: number | null;
  inputs: string[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

type RawEmbeddingItem = {
  embedding?: unknown;
  index?: unknown;
};

function normalizeEmbeddingPath(path: string) {
  const trimmed = path.trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');
  const lower = normalized.toLowerCase();

  if (lower.endsWith('/chat/completions')) {
    return `${normalized.slice(0, -'/chat/completions'.length)}/embeddings`;
  }
  if (lower.endsWith('/responses')) {
    return `${normalized.slice(0, -'/responses'.length)}/embeddings`;
  }
  if (lower.endsWith('/embeddings')) {
    return normalized;
  }
  return '/embeddings';
}

export function buildMemoryVectorEmbeddingEndpoint(api: ProviderProfile) {
  if (api.protocol !== 'openai-completions' && api.protocol !== 'openai-responses') {
    throw new Error('向量索引目前只支持 OpenAI 兼容的 embeddings 接口。');
  }
  return buildApiEndpoint(api.baseUrl, normalizeEmbeddingPath(api.path));
}

function shouldUseEmbeddingRelay(endpoint: string) {
  if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return false;
  if (!isProviderEmbeddingRelayTarget(endpoint)) return false;

  const currentOrigin = window.location?.origin;
  if (typeof currentOrigin !== 'string' || !currentOrigin) return false;

  try {
    return new URL(endpoint).origin !== currentOrigin;
  } catch {
    return false;
  }
}

function buildEmbeddingHeaders(api: ProviderProfile) {
  const apiKey = api.apiKey.trim();
  if (!apiKey) {
    throw new Error('请先在向量索引选择的线路里填写 API Key。');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
}

function normalizeInputs(inputs: string[]) {
  return inputs.map((input) => input.trim()).filter(Boolean);
}

function parseEmbeddingVector(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const vector = value.map((item) => Number(item));
  return vector.every((item) => Number.isFinite(item)) ? vector : null;
}

function parseEmbeddingResponse(data: unknown, expectedCount: number) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('embedding 响应不是 JSON 对象。');
  }

  const rawData = (data as { data?: unknown }).data;
  if (!Array.isArray(rawData)) {
    throw new Error('embedding 响应缺少 data 数组。');
  }

  const vectors: Array<number[] | undefined> = new Array(expectedCount);
  rawData.forEach((item, fallbackIndex) => {
    const rawItem = item as RawEmbeddingItem;
    const targetIndex = typeof rawItem.index === 'number' && Number.isInteger(rawItem.index)
      ? rawItem.index
      : fallbackIndex;
    const vector = parseEmbeddingVector(rawItem.embedding);
    if (!vector || targetIndex < 0 || targetIndex >= expectedCount) return;
    vectors[targetIndex] = vector;
  });

  for (let index = 0; index < expectedCount; index += 1) {
    if (!vectors[index]) {
      throw new Error('embedding 响应数量或向量内容不完整。');
    }
  }

  return vectors as number[][];
}

export async function requestMemoryVectorEmbeddings(params: MemoryVectorEmbeddingRequest) {
  const inputs = normalizeInputs(params.inputs);
  if (!inputs.length) return [];

  const endpoint = buildMemoryVectorEmbeddingEndpoint(params.api);
  const headers = buildEmbeddingHeaders(params.api);
  const body: Record<string, unknown> = {
    model: params.model,
    input: inputs
  };
  if (params.dimensions !== null) {
    body.dimensions = params.dimensions;
  }

  const useRelay = shouldUseEmbeddingRelay(endpoint);
  const fetchImpl = params.fetchImpl ?? fetch;
  const response = await fetchImpl(
    useRelay ? buildInternalApiEndpoint('/api/provider-embeddings') : endpoint,
    {
      method: 'POST',
      headers: useRelay ? { 'Content-Type': 'application/json' } : headers,
      body: JSON.stringify(useRelay ? { endpoint, headers, body } : body),
      signal: params.signal
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`embedding API ${response.status}: ${text.slice(0, 180)}`);
  }

  return parseEmbeddingResponse(await response.json(), inputs.length);
}
