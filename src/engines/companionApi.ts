import { buildApiEndpoint, buildInternalApiEndpoint } from './chat-api/chatApiEndpoint';
import type {
  CompanionSource,
  PolarisCompanionAutomationRule,
  PolarisCompanionCommand,
  PolarisCompanionPushPlatform,
  PolarisCompanionSnapshot
} from '../types/domain';

type JsonRecord = Record<string, unknown>;

export const COMPANION_RELAY_LOCAL_PLACEHOLDER = 'https://your-computer.example.com';

function buildCompanionEndpoint(relayUrl: string, path: string) {
  const trimmedRelay = relayUrl.trim();
  if (!trimmedRelay) {
    throw new Error('Companion relay URL 不能为空。');
  }
  return buildApiEndpoint(trimmedRelay, path);
}

async function postJson<T>(url: string, body: JsonRecord): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === 'object'
      && payload
      && 'error' in payload
      && typeof payload.error === 'object'
      && payload.error
      && 'message' in payload.error
      && typeof payload.error.message === 'string'
        ? payload.error.message
        : `Companion 请求失败：HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function isUserOwnedRelayHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'localhost' || normalized === '::1' || normalized.endsWith('.local')) return true;
  if (/^127\./.test(normalized)) return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  const private172 = normalized.match(/^172\.(\d+)\./);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
}

function isUserOwnedCompanionRelayOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return isUserOwnedRelayHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export function resolveDefaultCompanionRelayUrl() {
  const healthUrl = buildInternalApiEndpoint('/api/health');
  const origin = new URL(healthUrl).origin;
  return isUserOwnedCompanionRelayOrigin(origin) ? origin : '';
}

export function resolveCompanionRelayPlaceholder() {
  return resolveDefaultCompanionRelayUrl() || COMPANION_RELAY_LOCAL_PLACEHOLDER;
}

export async function registerCompanionHost(input: {
  relayUrl: string;
  label: string;
  source: CompanionSource;
  hostId?: string | null;
  hostSecret?: string | null;
}) {
  return await postJson<{
    hostId: string;
    hostSecret: string;
    pairCode: string;
    label: string;
    source: CompanionSource;
    registeredAt: number;
  }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/host/register'),
    {
      source: input.source,
      hostId: input.hostId ?? null,
      hostSecret: input.hostSecret ?? null,
      label: input.label
    }
  );
}

export async function publishCompanionSnapshot(input: {
  relayUrl: string;
  hostId: string;
  hostSecret: string;
  snapshot: PolarisCompanionSnapshot;
}) {
  return await postJson<{ ok: true }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/host/snapshot'),
    input
  );
}

export async function pullCompanionHostCommands(input: {
  relayUrl: string;
  hostId: string;
  hostSecret: string;
}) {
  return await postJson<{
    commands: PolarisCompanionCommand[];
  }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/host/pull'),
    input
  );
}

export async function publishCompanionAutomationRules(input: {
  relayUrl: string;
  hostId: string;
  hostSecret: string;
  rules: PolarisCompanionAutomationRule[];
}) {
  return await postJson<{ ok: true; ruleCount: number }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/host/automation'),
    input
  );
}

export async function publishCompanionClientAutomationRules(input: {
  relayUrl: string;
  hostId: string;
  clientId: string;
  clientSecret: string;
  rules: PolarisCompanionAutomationRule[];
}) {
  return await postJson<{ ok: true; ruleCount: number }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/client/automation'),
    input
  );
}

export function buildCompanionAutomationTriggerUrl(input: {
  relayUrl: string;
  hostId: string;
  ruleId: string;
  secret: string;
  prompt?: string | null;
}) {
  const endpoint = buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/automation/trigger');
  const url = new URL(endpoint);
  url.searchParams.set('hostId', input.hostId);
  url.searchParams.set('ruleId', input.ruleId);
  url.searchParams.set('secret', input.secret);
  if (input.prompt?.trim()) {
    url.searchParams.set('prompt', input.prompt.trim());
  }
  return url.toString();
}

export async function unregisterCompanionHost(input: {
  relayUrl: string;
  hostId: string;
  hostSecret: string;
}) {
  return await postJson<{ ok: true }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/host/unregister'),
    input
  );
}

export async function connectCompanionClient(input: {
  relayUrl: string;
  pairCode: string;
  label?: string;
}) {
  return await postJson<{
    hostId: string;
    hostLabel: string;
    source: CompanionSource;
    clientId: string;
    clientSecret: string;
    connectedAt: number;
  }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/client/connect'),
    {
      pairCode: input.pairCode,
      label: input.label ?? ''
    }
  );
}

export async function fetchCompanionClientSnapshot(input: {
  relayUrl: string;
  hostId: string;
  clientId: string;
  clientSecret: string;
}) {
  return await postJson<{
    hostLabel: string;
    snapshot: PolarisCompanionSnapshot | null;
  }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/client/snapshot'),
    input
  );
}

export async function sendCompanionClientCommand(input: {
  relayUrl: string;
  hostId: string;
  clientId: string;
  clientSecret: string;
  text: string;
}) {
  return await postJson<{ ok: true; commandId: string }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/client/command'),
    input
  );
}

export async function registerCompanionClientPushToken(input: {
  relayUrl: string;
  hostId: string;
  clientId: string;
  clientSecret: string;
  platform: PolarisCompanionPushPlatform;
  token: string;
}) {
  return await postJson<{ ok: true; updatedAt: number }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/client/push-token'),
    input
  );
}

export async function disconnectCompanionClient(input: {
  relayUrl: string;
  hostId: string;
  clientId: string;
  clientSecret: string;
}) {
  return await postJson<{ ok: true }>(
    buildCompanionEndpoint(input.relayUrl, '/api/companion/polaris/client/disconnect'),
    input
  );
}
