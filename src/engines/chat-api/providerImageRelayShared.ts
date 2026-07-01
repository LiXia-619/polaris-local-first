import { isPrivateHostname } from './providerRelayShared.js';

function normalizeImagePath(pathname: string) {
  return pathname.replace(/\/+$/, '').toLowerCase();
}

export function isProviderImageRelayTarget(endpoint: string) {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (isPrivateHostname(parsed.hostname)) return false;
  return normalizeImagePath(parsed.pathname).endsWith('/images/generations');
}

export function isProviderImageGenerationRequestBody(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.model !== 'string' || !record.model.trim()) return false;
  if (typeof record.prompt !== 'string' || !record.prompt.trim()) return false;
  if (record.size !== undefined && (typeof record.size !== 'string' || !record.size.trim())) return false;
  if (record.n !== undefined && (!Number.isInteger(record.n) || Number(record.n) < 1 || Number(record.n) > 4)) return false;
  return true;
}
