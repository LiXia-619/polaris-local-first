import { lookup } from 'node:dns/promises';
import { isProviderImageRelayTarget } from '../src/engines/chat-api/providerImageRelayShared.js';
import { isPrivateHostname } from '../src/engines/chat-api/providerRelayShared.js';

type RelayAddressRecord = {
  address: string;
};

type ProviderImageRelayTargetOptions = {
  lookupAddress?: (hostname: string) => Promise<RelayAddressRecord[]>;
};

export class ProviderImageRelayTargetError extends Error {
  constructor(message = '图片生成 relay 只接受公开 HTTPS 的图片生成接口。') {
    super(message);
    this.name = 'ProviderImageRelayTargetError';
  }
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
}

function isPrivateRelayAddress(address: string) {
  return isPrivateHostname(normalizeAddress(address));
}

async function resolveRelayAddresses(hostname: string) {
  try {
    return await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ProviderImageRelayTargetError('图片生成 relay 目标域名无法解析。');
  }
}

export async function validateProviderImageRelayTarget(
  endpoint: string,
  options: ProviderImageRelayTargetOptions = {}
) {
  if (!isProviderImageRelayTarget(endpoint)) {
    throw new ProviderImageRelayTargetError();
  }

  const parsed = new URL(endpoint);
  const hostname = normalizeAddress(parsed.hostname);
  if (isPrivateRelayAddress(hostname)) {
    throw new ProviderImageRelayTargetError('图片生成 relay 目标不能是本地或内网地址。');
  }

  const lookupAddress = options.lookupAddress ?? resolveRelayAddresses;
  const addresses = await lookupAddress(hostname);
  if (!addresses.length || addresses.some((record) => isPrivateRelayAddress(record.address))) {
    throw new ProviderImageRelayTargetError('图片生成 relay 目标解析到了本地或内网地址。');
  }

  return endpoint;
}
