import { lookup } from 'node:dns/promises';
import { isProviderEmbeddingRelayTarget } from '../src/engines/chat-api/providerEmbeddingRelayShared.js';
import { isPrivateHostname } from '../src/engines/chat-api/providerRelayShared.js';

type RelayAddressRecord = {
  address: string;
};

type ProviderEmbeddingRelayTargetOptions = {
  lookupAddress?: (hostname: string) => Promise<RelayAddressRecord[]>;
};

export class ProviderEmbeddingRelayTargetError extends Error {
  constructor(message = 'embedding relay 只接受公开 HTTPS 的 embeddings 接口。') {
    super(message);
    this.name = 'ProviderEmbeddingRelayTargetError';
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
    throw new ProviderEmbeddingRelayTargetError('embedding relay 目标域名无法解析。');
  }
}

export async function validateProviderEmbeddingRelayTarget(
  endpoint: string,
  options: ProviderEmbeddingRelayTargetOptions = {}
) {
  if (!isProviderEmbeddingRelayTarget(endpoint)) {
    throw new ProviderEmbeddingRelayTargetError();
  }

  const parsed = new URL(endpoint);
  const hostname = normalizeAddress(parsed.hostname);
  if (isPrivateRelayAddress(hostname)) {
    throw new ProviderEmbeddingRelayTargetError('embedding relay 目标不能是本地或内网地址。');
  }

  const lookupAddress = options.lookupAddress ?? resolveRelayAddresses;
  const addresses = await lookupAddress(hostname);
  if (!addresses.length || addresses.some((record) => isPrivateRelayAddress(record.address))) {
    throw new ProviderEmbeddingRelayTargetError('embedding relay 目标解析到了本地或内网地址。');
  }

  return endpoint;
}
