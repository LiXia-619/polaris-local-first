import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import { DEFAULT_APP_CUSTOMIZATION } from '../../stores/runtimeStoreCustomization';
import { DEFAULT_COMPANION_HOST_STATE } from '../../stores/runtimeStoreCompanion';
import { DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS } from '../../stores/runtimeStoreConversationSummary';
import { DEFAULT_IMAGE_GENERATION_SETTINGS } from '../../stores/runtimeStoreImageGeneration';
import { DEFAULT_IMAGE_UNDERSTANDING_SETTINGS } from '../../stores/runtimeStoreImageUnderstanding';
import { DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS } from '../../stores/runtimeStoreMemoryRetrieval';
import { DEFAULT_VOICE_GENERATION_SETTINGS } from '../../stores/runtimeStoreVoiceGeneration';
import { DEFAULT_WEB_SEARCH_CONFIG } from '../../stores/runtimeStoreSearch';
import { DEFAULT_RUNTIME_TOOLBOX_STATE } from '../../stores/runtimeStoreToolbox';
import { DEFAULT_WEBDAV_CONFIG } from '../../stores/runtimeStoreWebDav';
import { createInitialThemeState } from '../../stores/spaceStoreTheme';
import type { CodeCard, ProviderProfile, RoomProject } from '../../types/domain';
import {
  type LocalDataUnitOfWork,
  buildAssetLocalDataUnitOfWork,
  buildCollectionLocalDataUnitOfWork,
  buildDocumentLocalDataUnitOfWork,
  buildPersonaLocalDataUnitOfWork,
  buildRuntimeDomainMetaLocalDataRow,
  buildRuntimeLocalDataUnitOfWork,
  buildSpaceLocalDataUnitOfWork,
  createIncompleteLocalDataRow,
  getCollectionObjectLocalDataRef,
  getLocalDataRowKey,
  previewLocalDataStoreHydration
} from './index';

function entriesFromUnits(units: LocalDataUnitOfWork[]) {
  return units.flatMap((unit) => unit.mutations.flatMap((mutation) => {
    if (mutation.type !== 'put' && mutation.type !== 'restore') return [];
    return [{
      key: mutation.row.key,
      value: mutation.row
    }];
  }));
}

function card(seed: Partial<CodeCard> & Pick<CodeCard, 'id'>): CodeCard {
  return {
    title: seed.id,
    language: 'html',
    code: '',
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...seed
  };
}

function project(seed: Partial<RoomProject> & Pick<RoomProject, 'id'>): RoomProject {
  return {
    title: seed.id,
    slug: seed.id,
    fileIds: [],
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    pinnedAt: null,
    ...seed
  };
}

function provider(seed: Partial<ProviderProfile> & Pick<ProviderProfile, 'id'>): ProviderProfile {
  return {
    name: seed.name ?? seed.id,
    protocol: 'openai-completions',
    baseUrl: 'https://api.example.com',
    path: '/v1/chat/completions',
    apiKey: '',
    model: 'model-a',
    capabilities: {
      images: false,
      streaming: true,
      thinking: false
    },
    ...seed,
    id: seed.id
  };
}

describe('previewLocalDataStoreHydration', () => {
  it('hydrates lightweight store domains and keeps asset/document/chat boundaries explicit', () => {
    const collectionUnit = buildCollectionLocalDataUnitOfWork({
      version: 2,
      updatedAt: 10,
      activeProjectId: 'project-1',
      state: {
        cards: [card({ id: 'card-1' })],
        imageCards: [],
        roomProjects: [project({ id: 'project-1' })],
        projectFiles: [],
        workspaceReferenceDocs: []
      }
    });
    const personaUnit = buildPersonaLocalDataUnitOfWork({
      version: 2,
      updatedAt: 20,
      state: {
        personas: [createPersonaTemplate({ id: 'pharos', name: 'Pharos', description: '' })],
        activeCollaboratorId: 'pharos',
        seededDefaultPersonaIds: ['pharos']
      }
    });
    const runtimeUnit = buildRuntimeLocalDataUnitOfWork({
      version: 2,
      updatedAt: 30,
      state: {
        providers: [provider({ id: 'provider-1' })],
        activeProviderId: 'provider-1',
        webdav: DEFAULT_WEBDAV_CONFIG,
        search: DEFAULT_WEB_SEARCH_CONFIG,
        conversationSummaryModel: DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS,
        memoryVectorRetrieval: DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS,
        imageGeneration: DEFAULT_IMAGE_GENERATION_SETTINGS,
        imageUnderstanding: DEFAULT_IMAGE_UNDERSTANDING_SETTINGS,
        voiceGeneration: DEFAULT_VOICE_GENERATION_SETTINGS,
        toolPromptPreferences: DEFAULT_RUNTIME_TOOLBOX_STATE.toolPromptPreferences,
        taskModeEnabled: true,
        mcpServers: [],
        mcpToolTimeoutSeconds: 30,
        companionHost: DEFAULT_COMPANION_HOST_STATE,
        companionConnections: [],
        triggerRules: []
      }
    });
    const spaceUnit = buildSpaceLocalDataUnitOfWork({
      version: 2,
      updatedAt: 40,
      state: {
        activeWorld: 'chat',
        collectionShelf: 'project',
        frontstageCollaboratorId: 'pharos',
        collectionProjectId: 'project-1',
        editingCollaboratorId: null,
        screenshotDebugOverlayEnabled: false,
        appLanguage: 'zh-CN',
        displayPreferences: {
          appearance: 'system',
          hapticsEnabled: true,
          fontScale: 1
        },
        activeCardId: 'card-1',
        theme: createInitialThemeState(),
        customization: DEFAULT_APP_CUSTOMIZATION,
        collaboratorThemes: {}
      }
    });
    const assetUnit = buildAssetLocalDataUnitOfWork({
      version: 2,
      updatedAt: 50,
      state: {
        meta: [],
        binary: [],
        preview: [],
        ownersByAssetId: new Map()
      }
    });
    const documentUnit = buildDocumentLocalDataUnitOfWork({
      version: 2,
      updatedAt: 60,
      state: {
        documents: []
      }
    });

    const report = previewLocalDataStoreHydration(entriesFromUnits([
      collectionUnit,
      personaUnit,
      runtimeUnit,
      spaceUnit,
      assetUnit,
      documentUnit
    ]));

    expect(report.generatedAt).toEqual(expect.any(Number));
    expect(report.previews).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: 'collection',
        status: 'hydrated',
        activeProjectId: 'project-1',
        state: expect.objectContaining({
          cards: [expect.objectContaining({ id: 'card-1' })],
          roomProjects: [expect.objectContaining({ id: 'project-1' })]
        })
      }),
      expect.objectContaining({
        domain: 'persona',
        status: 'hydrated',
        activeCollaboratorId: 'pharos',
        state: expect.objectContaining({
          personas: [expect.objectContaining({ id: 'pharos' })]
        })
      }),
      expect.objectContaining({
        domain: 'runtime',
        status: 'hydrated',
        activeProviderId: 'provider-1',
        state: expect.objectContaining({
          providers: [expect.objectContaining({ id: 'provider-1' })],
          taskModeEnabled: true
        })
      }),
      expect.objectContaining({
        domain: 'space',
        status: 'hydrated',
        frontstageCollaboratorId: 'pharos',
        state: expect.objectContaining({
          activeWorld: 'chat',
          activeCardId: 'card-1'
        })
      }),
      expect.objectContaining({
        domain: 'asset',
        status: 'ledger-only',
        ledgerOnly: true
      }),
      expect.objectContaining({
        domain: 'document',
        status: 'ledger-only',
        ledgerOnly: true
      }),
      expect.objectContaining({
        domain: 'chat',
        status: 'delegated',
        delegatedTo: 'chatLocalDataPersistence'
      })
    ]));
  });

  it('blocks hydration when rows are not complete or required singleton rows are missing', () => {
    const incompleteCard = createIncompleteLocalDataRow({
      ref: getCollectionObjectLocalDataRef('card', 'card-1'),
      version: 2,
      updatedAt: 10,
      reason: 'missing-body',
      missingKeys: ['card:card-1']
    });
    const runtimeMetaOnly = buildRuntimeDomainMetaLocalDataRow({
      version: 2,
      updatedAt: 20,
      state: {
        providers: [],
        activeProviderId: null,
        webdav: DEFAULT_WEBDAV_CONFIG,
        search: DEFAULT_WEB_SEARCH_CONFIG,
        conversationSummaryModel: DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS,
        memoryVectorRetrieval: DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS,
        imageGeneration: DEFAULT_IMAGE_GENERATION_SETTINGS,
        imageUnderstanding: DEFAULT_IMAGE_UNDERSTANDING_SETTINGS,
        voiceGeneration: DEFAULT_VOICE_GENERATION_SETTINGS,
        toolPromptPreferences: DEFAULT_RUNTIME_TOOLBOX_STATE.toolPromptPreferences,
        taskModeEnabled: false,
        mcpServers: [],
        mcpToolTimeoutSeconds: 30,
        companionHost: DEFAULT_COMPANION_HOST_STATE,
        companionConnections: [],
        triggerRules: []
      }
    });

    const report = previewLocalDataStoreHydration([
      { key: getLocalDataRowKey(incompleteCard.ref), value: incompleteCard },
      { key: runtimeMetaOnly.key, value: runtimeMetaOnly }
    ], ['collection', 'runtime']);

    expect(report.previews).toEqual([
      expect.objectContaining({
        domain: 'collection',
        status: 'blocked',
        state: null,
        blockers: expect.arrayContaining([
          'card:card-1:incomplete',
          'missing-domain-meta'
        ])
      }),
      expect.objectContaining({
        domain: 'runtime',
        status: 'blocked',
        state: null,
        blockers: expect.arrayContaining(['settings-row-count:0'])
      })
    ]);
  });
});
