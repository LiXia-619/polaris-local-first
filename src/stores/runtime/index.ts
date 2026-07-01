import type { PolarisToolPromptGroup } from '../../engines/tool-protocol/assistantToolProtocolTypes';
import { kvGet } from '../../infrastructure/persistence';
import { reportPersistenceError } from '../../infrastructure/persistenceDiagnostics';
import type {
  McpServerConfig,
  PolarisCompanionConnection,
  PolarisCompanionHostState,
  PolarisTriggerRule,
  ConversationSummaryModelSettings,
  ImageGenerationSettings,
  ImageUnderstandingSettings,
  MemoryVectorRetrievalSettings,
  ProviderProfile,
  VoiceGenerationSettings,
  WebDavConfig,
  WebSearchConfig
} from '../../types/domain';
import {
  DEFAULT_PROVIDER,
  normalizeProviders,
  selectActiveProvider
} from '../runtimeStoreProviders';
import { isPolarisBuiltInProvider, isPolarisPublicProvider } from '../../engines/freeProvider';
import {
  DEFAULT_RUNTIME_TOOLBOX_STATE,
  normalizeRuntimeToolboxState
} from '../runtimeStoreToolbox';
import { DEFAULT_WEBDAV_CONFIG, normalizeWebDavConfig } from '../runtimeStoreWebDav';
import {
  DEFAULT_RUNTIME_MCP_STATE,
  normalizeRuntimeMcpState
} from '../runtimeStoreMcp';
import {
  DEFAULT_COMPANION_HOST_STATE,
  normalizeCompanionConnections,
  normalizeCompanionHostState
} from '../runtimeStoreCompanion';
import {
  normalizeRuntimeTriggerState
} from '../runtimeStoreTriggers';
import {
  DEFAULT_WEB_SEARCH_CONFIG,
  normalizeWebSearchConfig
} from '../runtimeStoreSearch';
import {
  DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS,
  normalizeConversationSummaryModelSettings
} from '../runtimeStoreConversationSummary';
import {
  DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS,
  normalizeMemoryVectorRetrievalSettings
} from '../runtimeStoreMemoryRetrieval';
import {
  DEFAULT_IMAGE_GENERATION_SETTINGS,
  normalizeImageGenerationSettings
} from '../runtimeStoreImageGeneration';
import {
  DEFAULT_IMAGE_UNDERSTANDING_SETTINGS,
  normalizeImageUnderstandingSettings
} from '../runtimeStoreImageUnderstanding';
import {
  DEFAULT_VOICE_GENERATION_SETTINGS,
  normalizeVoiceGenerationSettings
} from '../runtimeStoreVoiceGeneration';
import {
  commitRuntimeRowChangesFromStateActivating,
  readRuntimePayloadFromLocalDataRepositoryIfActive,
  type RuntimeLegacyLifecycleMap
} from './localData';
import { runExclusiveRuntimePersistenceCommit } from '../runtimePersistenceCommitQueue';

export type RuntimePayload = {
  providers: ProviderProfile[];
  activeProviderId: string | null;
  webdav: WebDavConfig;
  search: WebSearchConfig;
  conversationSummaryModel: ConversationSummaryModelSettings;
  memoryVectorRetrieval: MemoryVectorRetrievalSettings;
  imageGeneration: ImageGenerationSettings;
  imageUnderstanding: ImageUnderstandingSettings;
  voiceGeneration: VoiceGenerationSettings;
  toolPromptPreferences: Record<PolarisToolPromptGroup, boolean>;
  taskModeEnabled: boolean;
  mcpServers: McpServerConfig[];
  mcpToolTimeoutSeconds: number;
  companionHost: PolarisCompanionHostState;
  companionConnections: PolarisCompanionConnection[];
  triggerRules: PolarisTriggerRule[];
};

export type RuntimeHydrationResult = {
  payload: RuntimePayload;
  shouldPersist: boolean;
  // Sealed legacy runtime object rows surfaced as recoverable shells (keyed by `kind:id`). Empty
  // on the legacy-KV fallback path; populated only when the new-layer repository is active.
  legacyLifecycleByObjectId: RuntimeLegacyLifecycleMap;
};

function isLegacyFreeProvider(provider: ProviderProfile) {
  const name = provider.name?.trim() ?? '';
  const baseUrl = provider.baseUrl?.trim() ?? '';
  const path = provider.path?.trim() ?? '';
  const apiKey = provider.apiKey?.trim() ?? '';

  if (isPolarisBuiltInProvider(provider)) return false;
  if (name.includes('免费体验')) return true;

  return (
    !isPolarisPublicProvider(provider) &&
    baseUrl === '/api' &&
    path === '/chat/completions' &&
    (apiKey === 'polaris-free' || !apiKey)
  );
}

function isLegacyMimoInviteProvider(provider: ProviderProfile) {
  const baseUrl = provider.baseUrl?.trim() ?? '';
  const path = provider.path?.trim() ?? '';
  const apiKey = provider.apiKey?.trim() ?? '';

  if (isPolarisBuiltInProvider(provider)) return false;

  return (
    baseUrl === '/api/mimo'
    || (baseUrl === '/api' && path === '/mimo/chat/completions')
    || apiKey === 'polaris-mimo-invite'
  );
}

export function normalizeRuntimePayload(
  payload?: (Partial<RuntimePayload> & { forceToolUse?: boolean }) | null
): RuntimePayload {
  const sanitizedProviders = normalizeProviders(payload?.providers)
    .filter((provider) => !isLegacyFreeProvider(provider) && !isLegacyMimoInviteProvider(provider));
  const providers = sanitizedProviders.length
    ? sanitizedProviders
    : [{
        ...DEFAULT_PROVIDER,
        capabilities: {
          ...DEFAULT_PROVIDER.capabilities
        }
      }];
  const activeProvider = selectActiveProvider(providers, payload?.activeProviderId ?? null);

  return {
    providers,
    activeProviderId: activeProvider.id,
    webdav: normalizeWebDavConfig(payload?.webdav ?? DEFAULT_WEBDAV_CONFIG),
    search: normalizeWebSearchConfig(payload?.search ?? DEFAULT_WEB_SEARCH_CONFIG),
    conversationSummaryModel: normalizeConversationSummaryModelSettings(
      payload?.conversationSummaryModel ?? DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS
    ),
    memoryVectorRetrieval: normalizeMemoryVectorRetrievalSettings(
      payload?.memoryVectorRetrieval ?? DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS
    ),
    imageGeneration: normalizeImageGenerationSettings(
      payload?.imageGeneration ?? DEFAULT_IMAGE_GENERATION_SETTINGS
    ),
    imageUnderstanding: normalizeImageUnderstandingSettings(
      payload?.imageUnderstanding ?? DEFAULT_IMAGE_UNDERSTANDING_SETTINGS
    ),
    voiceGeneration: normalizeVoiceGenerationSettings(
      payload?.voiceGeneration ?? DEFAULT_VOICE_GENERATION_SETTINGS,
      providers
    ),
    companionHost: normalizeCompanionHostState(payload?.companionHost ?? DEFAULT_COMPANION_HOST_STATE),
    companionConnections: normalizeCompanionConnections(payload?.companionConnections),
    triggerRules: normalizeRuntimeTriggerState({
      triggerRules: payload?.triggerRules
    }).triggerRules,
    ...normalizeRuntimeMcpState({
      mcpServers: payload?.mcpServers,
      mcpToolTimeoutSeconds: payload?.mcpToolTimeoutSeconds
    }),
    ...normalizeRuntimeToolboxState({
      toolPromptPreferences: payload?.toolPromptPreferences,
      taskModeEnabled: payload?.taskModeEnabled,
      forceToolUse: payload?.forceToolUse
    })
  };
}

export async function hydrateFromDb(options: { throwOnReadFailure?: boolean } = {}) {
  try {
    const repositoryRead = await readRuntimePayloadFromLocalDataRepositoryIfActive();
    if (repositoryRead) {
      const normalized = normalizeRuntimePayload(repositoryRead.payload);

      return {
        payload: normalized,
        shouldPersist: false,
        legacyLifecycleByObjectId: repositoryRead.legacyLifecycleByObjectId
      } satisfies RuntimeHydrationResult;
    }

    const payload = await kvGet<Partial<RuntimePayload>>('runtime-providers-v2');
    if (payload && typeof payload === 'object') {
      const normalized = normalizeRuntimePayload(payload);
      const shouldRewrite = JSON.stringify(payload) !== JSON.stringify(normalized);

      return {
        payload: normalized,
        shouldPersist: shouldRewrite,
        legacyLifecycleByObjectId: {}
      } satisfies RuntimeHydrationResult;
    }

  } catch (e) {
    reportPersistenceError({ label: '[store:persist]', store: 'runtime', operation: 'read' }, e);
    if (options.throwOnReadFailure) {
      throw e;
    }
  }

  return null;
}

export async function persistToDb(payload: RuntimePayload) {
  try {
    const normalized = normalizeRuntimePayload(payload);
    // One serialized save path: write the normalized payload as LocalData runtime rows and,
    // on the first write, self-activate the runtime domain from its own committed rows.
    // Ordinary runtime saves never write the legacy `runtime-providers-v2` store — that store
    // is now hydrate-only legacy/migration read evidence for not-yet-activated installs. The
    // row writer does not re-acquire this queue.
    await runExclusiveRuntimePersistenceCommit(async () => {
      await commitRuntimeRowChangesFromStateActivating(normalized);
    });
  } catch (e) {
    reportPersistenceError({ label: '[store:persist]', store: 'runtime', operation: 'write' }, e);
    throw e;
  }
}
