import { isPrivateHostname } from './providerRelayShared.js';

function normalizeEmbeddingPath(pathname: string) {
  return pathname.replace(/\/+$/, '').toLowerCase();
}

export function isProviderEmbeddingRelayTarget(endpoint: string) {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (isPrivateHostname(parsed.hostname)) return false;
  return normalizeEmbeddingPath(parsed.pathname).endsWith('/embeddings');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && Boolean(item.trim()));
}

export function isProviderEmbeddingRequestBody(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.model !== 'string' || !record.model.trim()) return false;
  if (typeof record.input !== 'string' && !isStringArray(record.input)) return false;
  if (typeof record.input === 'string' && !record.input.trim()) return false;
  if (record.dimensions !== undefined) {
    if (typeof record.dimensions !== 'number' || !Number.isFinite(record.dimensions) || record.dimensions < 1) {
      return false;
    }
  }
  return true;
}
