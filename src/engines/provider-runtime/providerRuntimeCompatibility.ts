import type { ProviderProfile } from '../../types/domain';
import type { OpenAiToolHistoryMode } from './providerRuntimeOpenAiToolHistory';
import type {
  CanonicalProviderError,
  ProviderHttpRequest
} from './providerRuntimeTypes';

export type ProviderRuntimeCompatibilityReason =
  | 'native_tools_rejected'
  | 'message_roles_rejected';

export type ProviderRuntimeCompatibilityDegradation = {
  reason: ProviderRuntimeCompatibilityReason;
  disableNativeTools?: true;
  forceTranscriptMessages?: true;
};

export type ProviderRuntimeCompatibilityState = {
  disableNativeTools: boolean;
  forceTranscriptMessages: boolean;
};

export const EMPTY_PROVIDER_RUNTIME_COMPATIBILITY_STATE: ProviderRuntimeCompatibilityState = {
  disableNativeTools: false,
  forceTranscriptMessages: false
};

const providerRuntimeCompatibilityByRoute = new Map<string, ProviderRuntimeCompatibilityState>();

function normalizeKeyPart(value: string) {
  return value.trim().toLowerCase();
}

export function resolveProviderRuntimeCompatibilityKey(provider: ProviderProfile) {
  return [
    provider.id.trim(),
    provider.protocol,
    normalizeKeyPart(provider.baseUrl),
    provider.path.trim(),
    provider.model.trim()
  ].join('\u001f');
}

export function resolveProviderRuntimeCompatibilityState(
  provider: ProviderProfile
): ProviderRuntimeCompatibilityState {
  const cached = providerRuntimeCompatibilityByRoute.get(resolveProviderRuntimeCompatibilityKey(provider));
  return cached
    ? { ...cached }
    : { ...EMPTY_PROVIDER_RUNTIME_COMPATIBILITY_STATE };
}

export function mergeProviderRuntimeCompatibilityState(
  state: ProviderRuntimeCompatibilityState,
  degradation: ProviderRuntimeCompatibilityDegradation
): ProviderRuntimeCompatibilityState {
  return {
    disableNativeTools: state.disableNativeTools || degradation.disableNativeTools === true,
    forceTranscriptMessages: state.forceTranscriptMessages || degradation.forceTranscriptMessages === true
  };
}

export function recordProviderRuntimeCompatibilityDegradation(
  provider: ProviderProfile,
  degradation: ProviderRuntimeCompatibilityDegradation
): ProviderRuntimeCompatibilityState {
  const key = resolveProviderRuntimeCompatibilityKey(provider);
  const nextState = mergeProviderRuntimeCompatibilityState(
    providerRuntimeCompatibilityByRoute.get(key) ?? EMPTY_PROVIDER_RUNTIME_COMPATIBILITY_STATE,
    degradation
  );
  providerRuntimeCompatibilityByRoute.set(key, nextState);
  return { ...nextState };
}

export function resolveProviderRuntimeCompatibilityToolHistoryMode(
  preferredMode: OpenAiToolHistoryMode,
  state: ProviderRuntimeCompatibilityState
): OpenAiToolHistoryMode {
  return state.forceTranscriptMessages ? 'transcript' : preferredMode;
}

function requestContainsNativeTools(request: ProviderHttpRequest) {
  const tools = request.body.tools;
  return Array.isArray(tools) && tools.length > 0;
}

function isProviderRequestRejection(errorInfo: CanonicalProviderError) {
  return errorInfo.status === 400 || errorInfo.status === 404 || errorInfo.status === 422;
}

function isNativeToolSchemaRejection(errorInfo: CanonicalProviderError) {
  if (!isProviderRequestRejection(errorInfo)) return false;
  return /(?:tool use|tools? unsupported|unsupported tools?|function calling|function_call|tool_choice|No endpoints found[\s\S]*tools?|Try disabling\s+\\?["']?\w+\\?["']?)/i.test(
    errorInfo.rawMessage
  );
}

function isStrictMessageRoleRejection(errorInfo: CanonicalProviderError) {
  if (errorInfo.status !== 400) return false;
  return /(?:Conversation roles must alternate|roles must alternate|must alternate user\/assistant)/i.test(
    errorInfo.rawMessage
  );
}

export function classifyProviderRuntimeCompatibilityDegradation(input: {
  request: ProviderHttpRequest;
  errorInfo: CanonicalProviderError;
  sawProgress: boolean;
  openAiToolHistoryMode: OpenAiToolHistoryMode;
  state: ProviderRuntimeCompatibilityState;
}): ProviderRuntimeCompatibilityDegradation | null {
  if (input.sawProgress) return null;

  if (
    !input.state.disableNativeTools
    && requestContainsNativeTools(input.request)
    && isNativeToolSchemaRejection(input.errorInfo)
  ) {
    return {
      reason: 'native_tools_rejected',
      disableNativeTools: true
    };
  }

  if (
    !input.state.forceTranscriptMessages
    && input.openAiToolHistoryMode === 'native'
    && input.request.provider === 'openai-completions'
    && isStrictMessageRoleRejection(input.errorInfo)
  ) {
    return {
      reason: 'message_roles_rejected',
      forceTranscriptMessages: true
    };
  }

  return null;
}

export function clearProviderRuntimeCompatibilityCache() {
  providerRuntimeCompatibilityByRoute.clear();
}
