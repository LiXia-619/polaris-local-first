import { describe, expect, it } from 'vitest';
import { DEFAULT_COMPANION_HOST_STATE } from '../../stores/runtimeStoreCompanion';
import { DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS } from '../../stores/runtimeStoreConversationSummary';
import { DEFAULT_IMAGE_GENERATION_SETTINGS } from '../../stores/runtimeStoreImageGeneration';
import { DEFAULT_IMAGE_UNDERSTANDING_SETTINGS } from '../../stores/runtimeStoreImageUnderstanding';
import { DEFAULT_MEMORY_VECTOR_RETRIEVAL_SETTINGS } from '../../stores/runtimeStoreMemoryRetrieval';
import { DEFAULT_VOICE_GENERATION_SETTINGS } from '../../stores/runtimeStoreVoiceGeneration';
import { DEFAULT_WEB_SEARCH_CONFIG } from '../../stores/runtimeStoreSearch';
import { DEFAULT_RUNTIME_TOOLBOX_STATE } from '../../stores/runtimeStoreToolbox';
import { DEFAULT_WEBDAV_CONFIG } from '../../stores/runtimeStoreWebDav';
import type { CodeCard, ProviderProfile, RoomProject } from '../../types/domain';
import {
  type LocalDataCensusDomainReport,
  type LocalDataCensusReport,
  buildCollectionLocalDataUnitOfWork,
  buildLocalDataStoreHydrationValidationReports,
  buildLocalDataPromotionReadinessReport,
  buildLocalDataStoreHydrationValidationReport,
  buildRuntimeDomainMetaLocalDataRow,
  buildRuntimeLocalDataUnitOfWork,
  getLocalDataCommitPointerKey,
  previewLocalDataStoreHydration
} from './index';
import type { CommitPointerRow, LocalDataDomain, LocalDataUnitOfWork } from './types';
import { LocalDataMigrationValidationError } from './migrationValidation';

function pointer(domain: LocalDataDomain): CommitPointerRow {
  return {
    domain,
    version: 1,
    committedAt: 100,
    commitId: `${domain}-commit`
  };
}

function entriesFromUnits(units: LocalDataUnitOfWork[]) {
  return units.flatMap((unit) => unit.mutations.flatMap((mutation) => {
    if (mutation.type !== 'put' && mutation.type !== 'restore') return [];
    return [{ key: mutation.row.key, value: mutation.row }];
  }));
}

function domainReport(args: {
  domain: LocalDataDomain;
  baselineObjectIds: string[];
  activeObjectIds: string[];
  repositoryRowKeys: string[];
  missingOwnerObjectIds?: string[];
  missingBodyObjectIds?: string[];
  missingAssetMetaRefIds?: string[];
  missingAssetBinaryRefIds?: string[];
}): LocalDataCensusDomainReport {
  return {
    domain: args.domain,
    baselineObjectIds: args.baselineObjectIds,
    activeObjectIds: args.activeObjectIds,
    repositoryRowKeys: args.repositoryRowKeys,
    legacySourceKeys: args.baselineObjectIds,
    missingOwnerObjectIds: args.missingOwnerObjectIds ?? [],
    recoverableOwnerObjectIds: [],
    unresolvedOwnerObjectIds: [],
    danglingOwnerObjectIds: [],
    missingBodyObjectIds: args.missingBodyObjectIds ?? [],
    orphanBodyObjectIds: [],
    assetRefIds: [],
    missingAssetMetaRefIds: args.missingAssetMetaRefIds ?? [],
    missingAssetBinaryRefIds: args.missingAssetBinaryRefIds ?? [],
    metadataIssueIds: []
  };
}

function censusReport(domain: LocalDataCensusDomainReport, blockers: string[] = []): LocalDataCensusReport {
  return {
    ok: blockers.length === 0,
    activeDataSource: 'unknown',
    repositoryRowCount: domain.repositoryRowKeys.length,
    pointerCount: 1,
    knownCollaboratorIds: [],
    knownOwnerIds: [],
    domains: [domain],
    totals: {
      baselineObjectCount: domain.baselineObjectIds.length,
      activeObjectCount: domain.activeObjectIds.length,
      legacySourceCount: domain.legacySourceKeys.length,
      repositoryRowCount: domain.repositoryRowKeys.length,
      missingOwnerObjectCount: domain.missingOwnerObjectIds.length,
      recoverableOwnerObjectCount: 0,
      unresolvedOwnerObjectCount: 0,
      danglingOwnerObjectCount: 0,
      missingBodyObjectCount: 0,
      orphanBodyObjectCount: 0,
      missingAssetMetaRefCount: 0,
      missingAssetBinaryRefCount: 0,
      metadataIssueCount: 0
    },
    blockers,
    warnings: []
  };
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

function runtimeUnit() {
  return buildRuntimeLocalDataUnitOfWork({
    version: 1,
    updatedAt: 100,
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
}

describe('buildLocalDataStoreHydrationValidationReport', () => {
  it('builds a promotion validation report from collection census and hydration preview', () => {
    const unit = buildCollectionLocalDataUnitOfWork({
      version: 1,
      updatedAt: 100,
      activeProjectId: 'project-1',
      state: {
        cards: [card({ id: 'card-1' })],
        imageCards: [],
        roomProjects: [project({ id: 'project-1' })],
        projectFiles: [],
        workspaceReferenceDocs: []
      }
    });
    const entries = entriesFromUnits([unit]);
    const preview = previewLocalDataStoreHydration(entries, ['collection']).previews[0];
    if (preview.domain !== 'collection') throw new Error('Expected collection preview.');
    const report = buildLocalDataStoreHydrationValidationReport({
      pointer: pointer('collection'),
      censusDomainReport: domainReport({
        domain: 'collection',
        baselineObjectIds: ['card:card-1', 'project:project-1'],
        activeObjectIds: ['card:card-1', 'project:project-1'],
        repositoryRowKeys: entries.map((entry) => entry.key)
      }),
      hydrationPreview: preview,
      validatedAt: 101
    });

    expect(report).toEqual(expect.objectContaining({
      domain: 'collection',
      stagingHydrated: true,
      legacyBaselineCount: 2,
      activeObjectCount: 2,
      quarantinedObjectCount: 0,
      recoveredMetadata: {
        activeProjectId: 'project-1'
      }
    }));
  });

  it('quarantines unrecoverable source issues so readiness can skip them instead of blocking the domain', () => {
    const unit = buildCollectionLocalDataUnitOfWork({
      version: 1,
      updatedAt: 100,
      activeProjectId: 'project-1',
      state: {
        cards: [card({ id: 'card-1' })],
        imageCards: [],
        roomProjects: [project({ id: 'project-1' })],
        projectFiles: [],
        workspaceReferenceDocs: []
      }
    });
    const entries = entriesFromUnits([unit]);
    const preview = previewLocalDataStoreHydration(entries, ['collection']).previews[0];
    if (preview.domain !== 'collection') throw new Error('Expected collection preview.');
    const collectionDomainReport = domainReport({
      domain: 'collection',
      baselineObjectIds: ['card:card-1', 'project:project-1'],
      activeObjectIds: ['card:card-1', 'project:project-1'],
      repositoryRowKeys: entries.map((entry) => entry.key),
      missingBodyObjectIds: ['workspace-doc:missing-body']
    });
    const validation = buildLocalDataStoreHydrationValidationReport({
      pointer: pointer('collection'),
      censusDomainReport: collectionDomainReport,
      hydrationPreview: preview,
      validatedAt: 101
    });
    const readiness = buildLocalDataPromotionReadinessReport({
      domains: ['collection'],
      kv: [
        { key: getLocalDataCommitPointerKey('collection'), value: pointer('collection') },
        ...entries
      ],
      censusReport: censusReport(collectionDomainReport, ['collection:missing-body']),
      validationReports: {
        collection: validation
      }
    });

    expect(validation.quarantinedObjectIds).toContain('workspace-doc:missing-body');
    expect(readiness.canPromote).toBe(true);
    expect(readiness.domains[0]).toEqual(expect.objectContaining({
      status: 'promotion_ready_with_source_issues',
      blockers: ['collection:missing-body'],
      reasons: []
    }));
  });

  it('removes mixed unrecoverable issue ids from active evidence before promotion validation', () => {
    const unit = buildCollectionLocalDataUnitOfWork({
      version: 1,
      updatedAt: 100,
      activeProjectId: 'project-1',
      state: {
        cards: [card({ id: 'card-1' })],
        imageCards: [],
        roomProjects: [project({ id: 'project-1' })],
        projectFiles: [],
        workspaceReferenceDocs: []
      }
    });
    const entries = entriesFromUnits([unit]);
    const preview = previewLocalDataStoreHydration(entries, ['collection']).previews[0];
    if (preview.domain !== 'collection') throw new Error('Expected collection preview.');
    const collectionDomainReport = domainReport({
      domain: 'collection',
      baselineObjectIds: [
        'asset:missing-binary',
        'asset:missing-meta',
        'card:card-1',
        'project:project-1',
        'workspace-doc:missing-body'
      ],
      activeObjectIds: [
        'asset:missing-binary',
        'asset:missing-meta',
        'card:card-1',
        'project:project-1',
        'workspace-doc:missing-body'
      ],
      repositoryRowKeys: entries.map((entry) => entry.key),
      missingBodyObjectIds: ['workspace-doc:missing-body'],
      missingAssetMetaRefIds: ['asset:missing-meta'],
      missingAssetBinaryRefIds: ['asset:missing-binary']
    });
    const validation = buildLocalDataStoreHydrationValidationReport({
      pointer: pointer('collection'),
      censusDomainReport: collectionDomainReport,
      hydrationPreview: preview,
      validatedAt: 101
    });
    const readiness = buildLocalDataPromotionReadinessReport({
      domains: ['collection'],
      kv: [
        { key: getLocalDataCommitPointerKey('collection'), value: pointer('collection') },
        ...entries
      ],
      censusReport: censusReport(collectionDomainReport, [
        'collection:missing-asset-binary',
        'collection:missing-asset-meta',
        'collection:missing-body'
      ]),
      validationReports: {
        collection: validation
      }
    });

    expect(validation.activeObjectIds).toEqual(['card:card-1', 'project:project-1']);
    expect(validation.quarantinedObjectIds).toEqual([
      'asset:missing-binary',
      'asset:missing-meta',
      'workspace-doc:missing-body'
    ]);
    expect(readiness.canPromote).toBe(true);
    expect(readiness.domains[0]).toEqual(expect.objectContaining({
      status: 'promotion_ready_with_source_issues',
      blockers: [
        'collection:missing-asset-binary',
        'collection:missing-asset-meta',
        'collection:missing-body'
      ],
      reasons: []
    }));
  });

  it.each([
    {
      name: 'duplicate missing body ids mixed into active evidence',
      baselineObjectIds: ['card:card-1', 'project:project-1', 'workspace-doc:missing-body'],
      activeObjectIds: ['card:card-1', 'project:project-1', 'workspace-doc:missing-body'],
      missingBodyObjectIds: ['workspace-doc:missing-body', 'workspace-doc:missing-body'],
      missingAssetMetaRefIds: [],
      missingAssetBinaryRefIds: [],
      blockers: ['collection:missing-body'],
      expectedActiveObjectIds: ['card:card-1', 'project:project-1'],
      expectedQuarantinedObjectIds: ['workspace-doc:missing-body']
    },
    {
      name: 'baseline-only missing body id',
      baselineObjectIds: ['card:card-1', 'project:project-1', 'workspace-doc:missing-body'],
      activeObjectIds: ['card:card-1', 'project:project-1'],
      missingBodyObjectIds: ['workspace-doc:missing-body'],
      missingAssetMetaRefIds: [],
      missingAssetBinaryRefIds: [],
      blockers: ['collection:missing-body'],
      expectedActiveObjectIds: ['card:card-1', 'project:project-1'],
      expectedQuarantinedObjectIds: ['workspace-doc:missing-body']
    },
    {
      name: 'asset closure issues outside the object baseline',
      baselineObjectIds: ['card:card-1', 'project:project-1'],
      activeObjectIds: ['card:card-1', 'project:project-1'],
      missingBodyObjectIds: [],
      missingAssetMetaRefIds: ['asset:missing-meta'],
      missingAssetBinaryRefIds: ['asset:missing-binary'],
      blockers: ['collection:missing-asset-binary', 'collection:missing-asset-meta'],
      expectedActiveObjectIds: ['card:card-1', 'project:project-1'],
      expectedQuarantinedObjectIds: ['asset:missing-binary', 'asset:missing-meta']
    },
    {
      name: 'multiple body and asset issues mixed into active evidence',
      baselineObjectIds: [
        'asset:missing-binary',
        'card:card-1',
        'project:project-1',
        'workspace-doc:missing-a',
        'workspace-doc:missing-b'
      ],
      activeObjectIds: [
        'asset:missing-binary',
        'card:card-1',
        'project:project-1',
        'workspace-doc:missing-a',
        'workspace-doc:missing-b'
      ],
      missingBodyObjectIds: ['workspace-doc:missing-a', 'workspace-doc:missing-b'],
      missingAssetMetaRefIds: [],
      missingAssetBinaryRefIds: ['asset:missing-binary'],
      blockers: ['collection:missing-asset-binary', 'collection:missing-body'],
      expectedActiveObjectIds: ['card:card-1', 'project:project-1'],
      expectedQuarantinedObjectIds: ['asset:missing-binary', 'workspace-doc:missing-a', 'workspace-doc:missing-b']
    }
  ])('handles synthetic accident matrix: $name', (accident) => {
    const unit = buildCollectionLocalDataUnitOfWork({
      version: 1,
      updatedAt: 100,
      activeProjectId: 'project-1',
      state: {
        cards: [card({ id: 'card-1' })],
        imageCards: [],
        roomProjects: [project({ id: 'project-1' })],
        projectFiles: [],
        workspaceReferenceDocs: []
      }
    });
    const entries = entriesFromUnits([unit]);
    const preview = previewLocalDataStoreHydration(entries, ['collection']).previews[0];
    if (preview.domain !== 'collection') throw new Error('Expected collection preview.');
    const collectionDomainReport = domainReport({
      domain: 'collection',
      baselineObjectIds: accident.baselineObjectIds,
      activeObjectIds: accident.activeObjectIds,
      repositoryRowKeys: entries.map((entry) => entry.key),
      missingBodyObjectIds: accident.missingBodyObjectIds,
      missingAssetMetaRefIds: accident.missingAssetMetaRefIds,
      missingAssetBinaryRefIds: accident.missingAssetBinaryRefIds
    });
    const validation = buildLocalDataStoreHydrationValidationReport({
      pointer: pointer('collection'),
      censusDomainReport: collectionDomainReport,
      hydrationPreview: preview,
      validatedAt: 101
    });
    const readiness = buildLocalDataPromotionReadinessReport({
      domains: ['collection'],
      kv: [
        { key: getLocalDataCommitPointerKey('collection'), value: pointer('collection') },
        ...entries
      ],
      censusReport: censusReport(collectionDomainReport, accident.blockers),
      validationReports: {
        collection: validation
      }
    });

    expect(validation.activeObjectIds).toEqual(accident.expectedActiveObjectIds);
    expect(validation.quarantinedObjectIds).toEqual(accident.expectedQuarantinedObjectIds);
    expect(readiness.canPromote).toBe(true);
    expect(readiness.domains[0]).toEqual(expect.objectContaining({
      status: 'promotion_ready_with_source_issues',
      reasons: []
    }));
  });

  it('lets readiness mark a staged runtime domain promotion-ready after validation passes', () => {
    const unit = runtimeUnit();
    const entries = entriesFromUnits([unit]);
    const preview = previewLocalDataStoreHydration(entries, ['runtime']).previews[0];
    if (preview.domain !== 'runtime') throw new Error('Expected runtime preview.');
    const runtimeDomainReport = domainReport({
      domain: 'runtime',
      baselineObjectIds: ['runtime-providers-v2'],
      activeObjectIds: ['runtime-providers-v2'],
      repositoryRowKeys: entries.map((entry) => entry.key)
    });
    const validation = buildLocalDataStoreHydrationValidationReport({
      pointer: pointer('runtime'),
      censusDomainReport: runtimeDomainReport,
      hydrationPreview: preview,
      validatedAt: 101
    });
    const readiness = buildLocalDataPromotionReadinessReport({
      domains: ['runtime'],
      kv: [
        { key: getLocalDataCommitPointerKey('runtime'), value: pointer('runtime') },
        ...entries
      ],
      censusReport: censusReport(runtimeDomainReport),
      validationReports: {
        runtime: validation
      }
    });

    expect(readiness.canHydrate).toBe(true);
    expect(readiness.canPromote).toBe(true);
    expect(readiness.domains[0]).toEqual(expect.objectContaining({
      status: 'promotion_ready',
      remediation: []
    }));
  });

  it('generates non-chat validation reports in batch and leaves chat to its dedicated path', () => {
    const unit = runtimeUnit();
    const entries = [
      { key: getLocalDataCommitPointerKey('runtime'), value: pointer('runtime') },
      { key: getLocalDataCommitPointerKey('chat'), value: pointer('chat') },
      ...entriesFromUnits([unit])
    ];
    const runtimeDomainReport = domainReport({
      domain: 'runtime',
      baselineObjectIds: ['runtime-providers-v2'],
      activeObjectIds: ['runtime-providers-v2'],
      repositoryRowKeys: entries.filter((entry) => entry.key.includes(':row:runtime:')).map((entry) => entry.key)
    });
    const reports = buildLocalDataStoreHydrationValidationReports({
      kv: entries,
      censusDomains: [
        runtimeDomainReport,
        domainReport({
          domain: 'chat',
          baselineObjectIds: ['conversation-1'],
          activeObjectIds: ['conversation-1'],
          repositoryRowKeys: []
        })
      ],
      validatedAt: 101
    });

    expect(reports.validationReports.runtime).toEqual(expect.objectContaining({
      domain: 'runtime',
      stagingHydrated: true
    }));
    expect(reports.validationReports.chat).toBeUndefined();
    expect(reports.failures).toEqual({});
  });

  it('rejects blocked previews instead of manufacturing validation evidence', () => {
    const row = buildRuntimeDomainMetaLocalDataRow({
      version: 1,
      updatedAt: 100,
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
    const preview = previewLocalDataStoreHydration([{ key: row.key, value: row }], ['runtime']).previews[0];
    if (preview.domain !== 'runtime') throw new Error('Expected runtime preview.');

    expect(() => buildLocalDataStoreHydrationValidationReport({
      pointer: pointer('runtime'),
      censusDomainReport: domainReport({
        domain: 'runtime',
        baselineObjectIds: ['runtime-providers-v2'],
        activeObjectIds: ['runtime-providers-v2'],
        repositoryRowKeys: [row.key]
      }),
      hydrationPreview: preview,
      validatedAt: 101
    })).toThrow(LocalDataMigrationValidationError);
  });
});
