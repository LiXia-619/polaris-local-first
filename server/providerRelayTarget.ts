import { lookup } from 'node:dns/promises';
import { isAllowedProviderRelayTarget, isPrivateHostname } from '../src/engines/chat-api/providerRelayShared.js';

type RelayAddressRecord = {
  address: string;
};

type ProviderRelayTargetOptions = {
  lookupAddress?: (hostname: string) => Promise<RelayAddressRecord[]>;
};

export class ProviderRelayTargetError extends Error {
  constructor(message = '当前 relay 只接受公开 HTTPS 的文本生成接口。') {
    super(message);
    this.name = 'ProviderRelayTargetError';
  }
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
}

export function isPrivateRelayAddress(address: string) {
  return isPrivateHostname(normalizeAddress(address));
}

async function resolveRelayAddresses(hostname: string) {
  try {
    return await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ProviderRelayTargetError('relay 目标域名无法解析。');
  }
}

export async function validateProviderRelayTarget(endpoint: string, options: ProviderRelayTargetOptions = {}) {
  if (!isAllowedProviderRelayTarget(endpoint)) {
    throw new ProviderRelayTargetError();
  }

  const parsed = new URL(endpoint);
  const hostname = normalizeAddress(parsed.hostname);
  if (isPrivateRelayAddress(hostname)) {
    throw new ProviderRelayTargetError('relay 目标不能是本地或内网地址。');
  }

  const lookupAddress = options.lookupAddress ?? resolveRelayAddresses;
  const addresses = await lookupAddress(hostname);
  if (!addresses.length || addresses.some((record) => isPrivateRelayAddress(record.address))) {
    throw new ProviderRelayTargetError('relay 目标解析到了本地或内网地址。');
  }

  return endpoint;
}
