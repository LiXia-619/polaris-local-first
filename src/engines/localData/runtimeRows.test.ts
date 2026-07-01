import { describe, expect, it } from 'vitest';
import type { McpServerConfig, PolarisCompanionConnection, PolarisTriggerRule, ProviderProfile } from '../../types/domain';
import { DEFAULT_RUNTIME_TOOLBOX_STATE } from '../../stores/runtimeStoreToolbox';
import { DEFAULT_WEBDAV_CONFIG } from '../../stores/runtimeStoreWebDav';
import { DEFAULT_WEB_SEARCH_CONFIG } from '../../stores/runtimeStoreSearch';
import { DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS } from '../../stores/runtimeStoreConversationSummary';
import { DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS } from '../../stores/runtimeStoreMemoryRetrieval';
import { DEFAULT_IMAGE_GENERATION_SETTINGS } from '../../stores/runtimeStoreImageGeneration';
import { DEFAULT_IMAGE_UNDERSTANDING_SETTINGS } from '../../stores/runtimeStoreImageUnderstanding';
import { DEFAULT_VOICE_GENERATION_SETTINGS } from '../../stores/runtimeStoreVoiceGeneration';
import { DEFAULT_COMPANION_HOST_STATE } from '../../stores/runtimeStoreCompanion';
import {
  buildRuntimeLocalDataUnitOfWork,
  getRuntimeDomainMetaLocalDataRef,
  getRuntimeObjectLocalDataRef,
  toRuntimeObjectId
} from './runtimeRows';

function provider(seed: Partial<ProviderProfile> & Pick<ProviderProfile, 'id'>): ProviderProfile {
  return {
    id: seed.id,
    name: seed.name ?? seed.id,
    protocol: 'openai-completions',
    baseUrl: 'https://api.example.com',
    path: '/v1/chat/completions',
    apiKey: seed.apiKey ?? '',
    model: seed.model ?? 'model-a',
    capabilities: {
      images: false,
      streaming: true,
      thinking: false,
      ...seed.capabilities
    }
  };
}

function mcpServer(seed: Partial<McpServerConfig> & Pick<McpServerConfig, 'id'>): McpServerConfig {
  return {
    handle: seed.handle ?? seed.id,
    name: seed.name ?? seed.id,
    description: '',
    transport: 'streamable-http',
    url: 'https://mcp.example.com',
    headers: [],
    isActive: true,
    ...seed,
    id: seed.id
  };
}

function companionConnection(seed: Partial<PolarisCompanionConnection> & Pick<PolarisCompanionConnection, 'id'>): PolarisCompanionConnection {
  return {
    source: 'polaris',
    collaboratorId: seed.collaboratorId ?? 'pharos',
    conversationId: 'conversation-1',
    relayUrl: 'https://relay.example.com',
    hostId: 'host-1',
    clientId: 'client-1',
    clientSecret: 'secret',
    label: 'Phone',
    hostLabel: 'Mac',
    pushToken: null,
    pushPlatform: null,
    remoteThreadId: null,
    createdAt: 10,
    lastSnapshotAt: 20,
    lastError: null,
    ...seed,
    id: seed.id
  };
}

function triggerRule(seed: Partial<PolarisTriggerRule> & Pick<PolarisTriggerRule, 'id'>): PolarisTriggerRule {
  return {
    name: seed.name ?? seed.id,
    enabled: true,
    source: 'schedule',
    webhookSecret: 'secret',
    schedule: { kind: 'daily', time: '09:00' },
    target: {
      collaboratorId: seed.target?.collaboratorId ?? 'pharos',
      conversationMode: 'follow-latest',
      conversationId: null,
      ...seed.target
    },
    action: { prompt: 'hello', ...seed.action },
    createdAt: 30,
    updatedAt: 40,
    lastRunAt: null,
    nextRunAt: 100,
    lastError: null,
    ...seed,
    id: seed.id
  };
}

describe('buildRuntimeLocalDataUnitOfWork', () => {
  it('projects runtime settings and objects into independent complete rows plus domain metadata', () => {
    const unit = buildRuntimeLocalDataUnitOfWork({
      id: 'runtime-migration',
      version: 2,
      updatedAt: 50,
      state: {
        providers: [provider({ id: 'provider-1', apiKey: 'secret-key' })],
        activeProviderId: 'provider-1',
        webdav: { ...DEFAULT_WEBDAV_CONFIG, endpoint: 'https://dav.example.com' },
        search: { ...DEFAULT_WEB_SEARCH_CONFIG, provider: 'brave' },
        conversationSummaryModel: { ...DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS },
        memoryVectorRetrieval: { ...DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS },
        imageGeneration: { ...DEFAULT_IMAGE_GENERATION_SETTINGS },
        imageUnderstanding: { ...DEFAULT_IMAGE_UNDERSTANDING_SETTINGS },
        voiceGeneration: { ...DEFAULT_VOICE_GENERATION_SETTINGS },
        toolPromptPreferences: { ...DEFAULT_RUNTIME_TOOLBOX_STATE.toolPromptPreferences },
        taskModeEnabled: true,
        mcpServers: [mcpServer({ id: 'mcp-1' })],
        mcpToolTimeoutSeconds: 45,
        companionHost: { ...DEFAULT_COMPANION_HOST_STATE, enabled: true },
        companionConnections: [companionConnection({ id: 'connection-1', collaboratorId: 'pharos' })],
        triggerRules: [triggerRule({ id: 'trigger-1', target: { collaboratorId: 'pharos', conversationMode: 'follow-latest', conversationId: null } })]
      }
    });

    expect(unit).toEqual(expect.objectContaining({
      id: 'runtime-migration',
      domain: 'runtime',
      version: 2
    }));
    expect(unit.mutations).toHaveLength(6);
    expect(unit.mutations[0]).toEqual(expect.objectContaining({
      type: 'put',
      row: expect.objectContaining({
        ref: getRuntimeDomainMetaLocalDataRef(),
        value: expect.objectContaining({
          activeProviderId: 'provider-1',
          activeObjectCount: 5,
          objectCounts: {
            settings: 1,
            provider: 1,
            'mcp-server': 1,
            'companion-connection': 1,
            'trigger-rule': 1
          }
        })
      })
    }));
    expect(unit.mutations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getRuntimeObjectLocalDataRef('settings', 'runtime-settings'),
          value: expect.objectContaining({
            objectId: toRuntimeObjectId('settings', 'runtime-settings'),
            value: expect.objectContaining({
              taskModeEnabled: true,
              mcpToolTimeoutSeconds: 45
            })
          })
        })
      }),
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getRuntimeObjectLocalDataRef('provider', 'provider-1'),
          value: expect.objectContaining({
            objectId: toRuntimeObjectId('provider', 'provider-1'),
            value: expect.objectContaining({
              apiKey: 'secret-key'
            })
          })
        })
      }),
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getRuntimeObjectLocalDataRef('companion-connection', 'connection-1'),
          value: expect.objectContaining({
            ownerCollaboratorId: 'pharos',
            updatedAt: 20
          })
        })
      }),
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getRuntimeObjectLocalDataRef('trigger-rule', 'trigger-1'),
          value: expect.objectContaining({
            ownerCollaboratorId: 'pharos',
            updatedAt: 40
          })
        })
      })
    ]));
  });
});
