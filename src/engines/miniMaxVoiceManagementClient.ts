import { Capacitor } from '@capacitor/core';
import { buildApiEndpoint, buildInternalApiEndpoint } from './chat-api/chatApiEndpoint';
import { isProviderAudioRelayTarget } from './chat-api/providerAudioRelayShared';
import { assertHttpHeaderValue } from './httpHeaderValue';
import type {
  VoiceGenerationCustomVoice,
  VoiceGenerationSettings
} from '../types/domain';

export type MiniMaxVoiceCatalogEntry = VoiceGenerationCustomVoice;

export type MiniMaxVoiceDesignRequest = {
  settings: VoiceGenerationSettings;
  prompt: string;
  previewText: string;
  voiceId?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export type MiniMaxVoiceDesignResult = {
  voiceId: string;
  blob: Blob;
  mimeType: string;
};

const MINIMAX_PREVIEW_MIME_TYPE = 'audio/mpeg';

function normalizeMiniMaxVoiceManagementPath(path: string, fallback: '/get_voice' | '/voice_design') {
  const trimmed = path.trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');
  const lower = normalized.toLowerCase();

  if (lower.endsWith('/get_voice')) {
    return normalized.slice(0, -'/get_voice'.length) + fallback;
  }
  if (lower.endsWith('/voice_design')) {
    return normalized.slice(0, -'/voice_design'.length) + fallback;
  }
  if (lower.endsWith('/t2a_v2')) {
    return normalized.slice(0, -'/t2a_v2'.length) + fallback;
  }
  return fallback;
}

function buildMiniMaxVoiceManagementEndpoint(
  settings: Pick<VoiceGenerationSettings, 'providerType' | 'baseUrl' | 'path'>,
  fallback: '/get_voice' | '/voice_design'
) {
  if (settings.providerType !== 'minimax') {
    throw new Error('MiniMax 音色库只支持 MiniMax T2A 接口。');
  }
  const baseUrl = settings.baseUrl?.trim();
  if (!baseUrl) {
    throw new Error('请先填写 MiniMax Base URL。');
  }
  return buildApiEndpoint(baseUrl, normalizeMiniMaxVoiceManagementPath(settings.path ?? '', fallback));
}

function buildMiniMaxHeaders(settings: Pick<VoiceGenerationSettings, 'apiKey'>) {
  const apiKey = settings.apiKey?.trim() ?? '';
  if (!apiKey) {
    throw new Error('请先填写语音模型的 API Key。');
  }
  assertHttpHeaderValue(apiKey, 'MiniMax API Key');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
}

function shouldUseVoiceRelay(endpoint: string) {
  if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return false;
  if (!isProviderAudioRelayTarget(endpoint)) return false;

  const currentOrigin = window.location?.origin;
  if (typeof currentOrigin !== 'string' || !currentOrigin) return false;

  try {
    return new URL(endpoint).origin !== currentOrigin;
  } catch {
    return false;
  }
}

function hexToAudioBlob(hex: string, mimeType: string) {
  const normalized = hex.trim();
  if (!normalized || normalized.length % 2 !== 0 || !/^[\da-f]+$/i.test(normalized)) {
    throw new Error('MiniMax 语音 API 返回了无效的音频数据。');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return new Blob([bytes], { type: mimeType });
}

function buildMiniMaxVoiceDesignBody(prompt: string, previewText: string, voiceId?: string) {
  const body: Record<string, string> = {
    prompt,
    preview_text: previewText
  };
  if (voiceId?.trim()) {
    body.voice_id = voiceId.trim();
  }
  return body;
}

function readMiniMaxStatus(payload: {
  base_resp?: {
    status_code?: unknown;
    status_msg?: unknown;
  };
}) {
  const statusCode = payload.base_resp?.status_code;
  if (typeof statusCode === 'number' && statusCode !== 0) {
    const statusMessage = typeof payload.base_resp?.status_msg === 'string'
      ? payload.base_resp.status_msg
      : 'MiniMax 语音接口请求失败。';
    throw new Error(statusMessage);
  }
}

function normalizeMiniMaxVoiceDescription(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      .join(' / ');
  }
  return typeof value === 'string' ? value.trim() : '';
}

function collectMiniMaxVoiceEntries(
  value: unknown,
  source: VoiceGenerationCustomVoice['source'],
  now: number
): MiniMaxVoiceCatalogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): MiniMaxVoiceCatalogEntry[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const voice = typeof record.voice_id === 'string' ? record.voice_id.trim() : '';
    if (!voice) return [];
    const explicitName = typeof record.display_name === 'string'
      ? record.display_name.trim()
      : typeof record.name === 'string'
        ? record.name.trim()
        : '';
    const description = normalizeMiniMaxVoiceDescription(record.description);
    const createdAt = typeof record.created_time === 'string' && record.created_time.trim()
      ? Date.parse(record.created_time)
      : undefined;
    return [{
      id: `minimax-${source}-${voice}`,
      providerType: 'minimax',
      label: explicitName || description || voice,
      voice,
      source,
      createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
      updatedAt: now
    }];
  });
}

async function requestMiniMaxJson(
  endpoint: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal: AbortSignal | undefined,
  fetchImpl: typeof fetch
) {
  const useRelay = shouldUseVoiceRelay(endpoint);
  const response = await fetchImpl(
    useRelay ? buildInternalApiEndpoint('/api/provider-audio') : endpoint,
    {
      method: 'POST',
      headers: useRelay ? { 'Content-Type': 'application/json' } : headers,
      body: JSON.stringify(useRelay ? { endpoint, headers, body } : body),
      signal
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MiniMax 语音 API ${response.status}: ${text.slice(0, 180)}`);
  }

  return response.json();
}

export async function requestMiniMaxVoiceCatalog(params: {
  settings: VoiceGenerationSettings;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<MiniMaxVoiceCatalogEntry[]> {
  const endpoint = buildMiniMaxVoiceManagementEndpoint(params.settings, '/get_voice');
  const headers = buildMiniMaxHeaders(params.settings);
  const payload = await requestMiniMaxJson(
    endpoint,
    headers,
    { voice_type: 'all' },
    params.signal,
    params.fetchImpl ?? fetch
  ) as {
    system_voice?: unknown;
    voice_cloning?: unknown;
    voice_generation?: unknown;
    base_resp?: {
      status_code?: unknown;
      status_msg?: unknown;
    };
  };

  readMiniMaxStatus(payload);
  const now = Date.now();
  return [
    ...collectMiniMaxVoiceEntries(payload.system_voice, 'minimax-system', now),
    ...collectMiniMaxVoiceEntries(payload.voice_cloning, 'minimax-clone', now),
    ...collectMiniMaxVoiceEntries(payload.voice_generation, 'minimax-generation', now)
  ];
}

export async function requestMiniMaxVoiceDesign(params: MiniMaxVoiceDesignRequest): Promise<MiniMaxVoiceDesignResult> {
  const prompt = params.prompt.trim();
  const previewText = params.previewText.trim();
  if (!prompt) {
    throw new Error('音色描述不能为空。');
  }
  if (!previewText) {
    throw new Error('试听文本不能为空。');
  }
  if (previewText.length > 500) {
    throw new Error('MiniMax 试听文本最多 500 字。');
  }

  const endpoint = buildMiniMaxVoiceManagementEndpoint(params.settings, '/voice_design');
  const headers = buildMiniMaxHeaders(params.settings);
  const payload = await requestMiniMaxJson(
    endpoint,
    headers,
    buildMiniMaxVoiceDesignBody(prompt, previewText, params.voiceId),
    params.signal,
    params.fetchImpl ?? fetch
  ) as {
    voice_id?: unknown;
    trial_audio?: unknown;
    base_resp?: {
      status_code?: unknown;
      status_msg?: unknown;
    };
  };

  readMiniMaxStatus(payload);
  const voiceId = typeof payload.voice_id === 'string' ? payload.voice_id.trim() : '';
  if (!voiceId) {
    throw new Error('MiniMax 没有返回音色 ID。');
  }
  if (typeof payload.trial_audio !== 'string') {
    throw new Error('MiniMax 没有返回试听音频。');
  }
  return {
    voiceId,
    blob: hexToAudioBlob(payload.trial_audio, MINIMAX_PREVIEW_MIME_TYPE),
    mimeType: MINIMAX_PREVIEW_MIME_TYPE
  };
}
