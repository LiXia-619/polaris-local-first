const FORBIDDEN_RELAY_HEADER_NAMES = new Set([
  'connection',
  'content-length',
  'host',
  'origin',
  'referer',
  'transfer-encoding'
]);

const PROVIDER_RELAY_AUTH_HEADER_NAMES = new Set([
  'authorization',
  'x-api-key',
  'x-goog-api-key',
  'xi-api-key'
]);

const NON_RELAYABLE_PATH_HINTS = [
  'embedding',
  'embeddings',
  'image',
  'images',
  'audio',
  'speech',
  'transcription',
  'transcriptions',
  'moderation',
  'moderations',
  'upload',
  'uploads',
  'file',
  'files',
  'batch',
  'batches',
  'finetuning',
  'fine-tuning',
  'rerank',
  'reranking'
];

function normalizeRelayPath(pathname: string) {
  return pathname.replace(/\/+$/, '').toLowerCase();
}

function pathContainsAny(pathname: string, hints: string[]) {
  return hints.some((hint) => pathname.includes(hint));
}

function matchesRelayablePath(pathname: string) {
  const normalized = normalizeRelayPath(pathname);
  if (!normalized) return false;
  if (pathContainsAny(normalized, NON_RELAYABLE_PATH_HINTS)) return false;
  return true;
}

export function isPrivateHostname(hostname: string) {
  const lower = hostname.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!lower) return true;
  if (lower === 'localhost' || lower.endsWith('.local')) return true;
  const mappedIpv4 = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateHostname(mappedIpv4[1]);
  const mappedIpv4Hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedIpv4Hex) {
    const high = parseInt(mappedIpv4Hex[1], 16);
    const low = parseInt(mappedIpv4Hex[2], 16);
    return isPrivateHostname([high >> 8, high & 255, low >> 8, low & 255].join('.'));
  }
  if (lower === '::' || lower === '::1') return true;
  if (lower.includes(':') && (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:'))) {
    return true;
  }
  const ipv4 = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
  }
  return false;
}

export function isAllowedProviderRelayTarget(endpoint: string) {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (isPrivateHostname(parsed.hostname)) return false;
  return matchesRelayablePath(parsed.pathname);
}

export function isProviderModelListRelayTarget(endpoint: string) {
  if (!isAllowedProviderRelayTarget(endpoint)) return false;
  try {
    const parsed = new URL(endpoint);
    return normalizeRelayPath(parsed.pathname).endsWith('/models');
  } catch {
    return false;
  }
}

export function sanitizeProviderRelayHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).filter(([rawKey, value]) => {
      if (typeof value !== 'string' || !value.trim()) return false;
      const key = rawKey.trim().toLowerCase();
      if (!key) return false;
      if (FORBIDDEN_RELAY_HEADER_NAMES.has(key)) return false;
      if (key.startsWith('x-forwarded-')) return false;
      return true;
    })
  );
}

export function hasProviderRelayAuthHeader(headers: Record<string, string>) {
  return Object.keys(headers).some((key) => PROVIDER_RELAY_AUTH_HEADER_NAMES.has(key.trim().toLowerCase()));
}
