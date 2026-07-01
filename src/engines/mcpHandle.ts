import { createUid } from './id';

function normalizeMcpHandleFragment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function buildMcpHandle(seed: {
  handle?: string;
  name?: string;
  url?: string;
  id?: string;
}) {
  const candidates = [
    seed.handle,
    seed.name,
    seed.url,
    seed.id
  ];

  for (const candidate of candidates) {
    const normalized = normalizeMcpHandleFragment(candidate ?? '');
    if (normalized) return normalized;
  }

  return `mcp_${createUid('mcp').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
}
