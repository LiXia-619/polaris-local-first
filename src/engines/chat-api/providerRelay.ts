import { Capacitor } from '@capacitor/core';
import type { ProviderProfile } from '../../types/domain';
import type { BuiltRequest } from './chatApiTypes';
export {
  hasProviderRelayAuthHeader,
  isAllowedProviderRelayTarget,
  isProviderModelListRelayTarget,
  sanitizeProviderRelayHeaders
} from './providerRelayShared';
import { isAllowedProviderRelayTarget } from './providerRelayShared';

export const ANTHROPIC_BROWSER_ACCESS_HEADER = 'anthropic-dangerous-direct-browser-access';

export function isOfficialAnthropicApiEndpoint(endpointText: string) {
  try {
    const endpoint = new URL(endpointText);
    return endpoint.hostname === 'api.anthropic.com';
  } catch {
    return false;
  }
}

function isOfficialAnthropicMessagesEndpoint(request: BuiltRequest) {
  if (request.provider !== 'anthropic-messages') return false;
  if (!isOfficialAnthropicApiEndpoint(request.endpoint)) return false;

  try {
    return new URL(request.endpoint).pathname.replace(/\/+$/, '') === '/v1/messages';
  } catch {
    return false;
  }
}

export function shouldUseAnthropicBrowserDirectAccess(request: BuiltRequest) {
  if (typeof window === 'undefined') return false;
  return isOfficialAnthropicMessagesEndpoint(request);
}

export function shouldUseBrowserProviderRelay(api: ProviderProfile, request: BuiltRequest) {
  if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return false;
  if (request.usesBuiltInTrial) return false;
  if (shouldUseAnthropicBrowserDirectAccess(request)) return false;
  if (!isAllowedProviderRelayTarget(request.endpoint)) return false;

  const currentOrigin = window.location?.origin;
  if (typeof currentOrigin !== 'string' || !currentOrigin) return false;

  let endpoint: URL;
  try {
    endpoint = new URL(request.endpoint);
  } catch {
    return false;
  }

  if (endpoint.origin === currentOrigin) return false;

  void api;
  return true;
}
