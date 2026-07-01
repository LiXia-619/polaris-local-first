import { Capacitor } from '@capacitor/core';
import { buildApiEndpoint, buildInternalApiEndpoint } from './chat-api/chatApiEndpoint';
import { isProviderImageRelayTarget } from './chat-api/providerImageRelayShared';
import type { ImageGenerationSettings, ProviderProfile } from '../types/domain';

export type ImageGenerationRequest = {
  api: ProviderProfile;
  settings: ImageGenerationSettings;
  prompt: string;
  title?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export type ImageGenerationResult = {
  blob: Blob;
  mimeType: string;
  fileName: string;
  model: string;
  size: string;
};

function normalizeImageGenerationPath(path: string) {
  const trimmed = path.trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');
  const lower = normalized.toLowerCase();

  if (lower.endsWith('/chat/completions')) {
    return `${normalized.slice(0, -'/chat/completions'.length)}/images/generations`;
  }
  if (lower.endsWith('/responses')) {
    return `${normalized.slice(0, -'/responses'.length)}/images/generations`;
  }
  if (lower.endsWith('/images/generations')) {
    return normalized;
  }
  return '/images/generations';
}

export function buildImageGenerationEndpoint(api: ProviderProfile) {
  if (api.protocol !== 'openai-completions' && api.protocol !== 'openai-responses') {
    throw new Error('生图目前只支持 OpenAI 兼容的 images/generations 接口。');
  }
  return buildApiEndpoint(api.baseUrl, normalizeImageGenerationPath(api.path));
}

function shouldUseImageRelay(endpoint: string) {
  if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return false;
  if (!isProviderImageRelayTarget(endpoint)) return false;

  const currentOrigin = window.location?.origin;
  if (typeof currentOrigin !== 'string' || !currentOrigin) return false;

  try {
    return new URL(endpoint).origin !== currentOrigin;
  } catch {
    return false;
  }
}

function buildImageHeaders(api: ProviderProfile) {
  const apiKey = api.apiKey.trim();
  if (!apiKey) {
    throw new Error('请先在生图模型选择的线路里填写 API Key。');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
}

function sanitizeFileName(value: string | undefined) {
  const title = value?.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80);
  return `${title || 'generated-image'}.png`;
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function parseImageResponse(data: unknown, fetchImpl: typeof fetch): Promise<{ blob: Blob; mimeType: string }> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('生图响应不是 JSON 对象。');
  }

  const first = (data as { data?: unknown }).data;
  if (!Array.isArray(first) || !first.length || !first[0] || typeof first[0] !== 'object') {
    throw new Error('生图响应缺少 data 图片结果。');
  }

  const item = first[0] as { b64_json?: unknown; url?: unknown };
  if (typeof item.b64_json === 'string' && item.b64_json.trim()) {
    return {
      blob: base64ToBlob(item.b64_json.trim(), 'image/png'),
      mimeType: 'image/png'
    };
  }

  if (typeof item.url === 'string' && item.url.trim()) {
    const response = await fetchImpl(item.url.trim());
    if (!response.ok) {
      throw new Error(`读取生图结果失败：${response.status}`);
    }
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    return {
      blob: await response.blob(),
      mimeType
    };
  }

  throw new Error('生图响应没有 b64_json 或 url。');
}

export async function requestGeneratedImage(params: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const prompt = params.prompt.trim();
  if (!prompt) {
    throw new Error('生图提示词不能为空。');
  }
  if (!params.settings.enabled) {
    throw new Error('生图模型尚未开启。请先到设置 → 生图里打开生图。');
  }

  const model = params.settings.modelOverride?.trim() || params.api.model.trim();
  if (!model) {
    throw new Error('生图模型不能为空。');
  }

  const endpoint = buildImageGenerationEndpoint(params.api);
  const headers = buildImageHeaders(params.api);
  const size = params.settings.size || '1024x1024';
  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    response_format: 'b64_json'
  };
  if (size !== 'auto') {
    body.size = size;
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  const useRelay = shouldUseImageRelay(endpoint);
  const response = await fetchImpl(
    useRelay ? buildInternalApiEndpoint('/api/provider-images') : endpoint,
    {
      method: 'POST',
      headers: useRelay ? { 'Content-Type': 'application/json' } : headers,
      body: JSON.stringify(useRelay ? { endpoint, headers, body } : body),
      signal: params.signal
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`生图 API ${response.status}: ${text.slice(0, 180)}`);
  }

  const parsed = await parseImageResponse(await response.json(), fetchImpl);
  return {
    ...parsed,
    fileName: sanitizeFileName(params.title),
    model,
    size
  };
}
