import { resolveProviderRuntimeRequestAdapter } from './providerRuntimeAdapters';
import type { ProviderRuntimeRequestInput } from './providerRuntimeRequestTypes';
import type { ProviderHttpRequest } from './providerRuntimeTypes';

export function buildProviderRuntimeRequest(input: ProviderRuntimeRequestInput): ProviderHttpRequest {
  return resolveProviderRuntimeRequestAdapter(input.api).buildRequest(input);
}
