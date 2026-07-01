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
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import type { ProviderProfile } from '../../types/domain';
import {
  buildLocalDataPromotionReadinessReport
} from './promotionReadiness';
import {
  buildPersonaLocalDataUnitOfWork,
  buildRuntimeDomainMetaLocalDataRow,
  buildRuntimeLocalDataUnitOfWork,
  createCompleteLocalDataRow,
  createIncompleteLocalDataRow,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  type CommitPointerRow,
  type LocalDataCensusReport,
  type LocalDataCensusDomainReport,
  type LocalDataDomain,
  type LocalDataMigrationValidationReport,
  type LocalDataUnitOfWork
} from './index';

function pointer(domain: LocalDataDomain): CommitPointerRow {
  return {
    domain,
    version: 1,
    committedAt: 100,
    commitId: `${domain}-commit`
  };
}

function domainReport(domain: LocalDataDomain, rowKeys: string[] | string): LocalDataCensusDomainReport {
  const repositoryRowKeys = Array.isArray(rowKeys) ? rowKeys : [rowKeys];
  return {
    domain,
    baselineObjectIds: [`${domain}-object`],
    activeObjectIds: [`${domain}-object`],
    repositoryRowKeys,
    legacySourceKeys: [`${domain}-legacy`],
    missingOwnerObjectIds: [],
    recoverableOwnerObjectIds: [],
    unresolvedOwnerObjectIds: [],
    danglingOwnerObjectIds: [],
    missingBodyObjectIds: [],
    orphanBodyObjectIds: [],
    assetRefIds: [],
    missingAssetMetaRefIds: [],
    missingAssetBinaryRefIds: [],
    metadataIssueIds: []
  };
}

function censusReport(domains: LocalDataCensusDomainReport[], blockers: string[] = []): LocalDataCensusReport {
  return {
    ok: blockers.length === 0,
    activeDataSource: 'unknown',
    repositoryRowCount: domains.reduce((sum, domain) => sum + domain.repositoryRowKeys.length, 0),
    pointerCount: domains.length,
    knownCollaboratorIds: [],
    knownOwnerIds: [],
    domains,
    totals: {
      baselineObjectCount: domains.reduce((sum, domain) => sum + domain.baselineObjectIds.length, 0),
      activeObjectCount: domains.reduce((sum, domain) => sum + domain.activeObjectIds.length, 0),
      legacySourceCount: domains.reduce((sum, domain) => sum + domain.legacySourceKeys.length, 0),
      repositoryRowCount: domains.reduce((sum, domain) => sum + domain.repositoryRowKeys.length, 0),
      missingOwnerObjectCount: 0,
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

function validationReport(domain: LocalDataDomain): LocalDataMigrationValidationReport {
  const meta = pointer(domain);
  return {
    id: `${domain}:validation`,
    domain,
    commitId: meta.commitId,
    version: meta.version,
    validatedAt: 101,
    stagingHydrated: true,
    legacyBaselineCount: 1,
    legacyBaselineObjectIds: [`${domain}-object`],
    activeBaselineObjectIds: [`${domain}-object`],
    activeObjectCount: 1,
    activeObjectIds: [`${domain}-object`],
    quarantinedObjectCount: 0,
    quarantinedObjectIds: [],
    duplicateObjectIdCount: 0,
    missingActiveCollaboratorIdCount: 0,
    missingActiveCollaboratorIds: [],
    activeIncompleteRowCount: 0,
    activeTimedOutRowCount: 0,
    recoveredMetadata: requiredRecoveredMetadata(domain)
  };
}

function requiredRecoveredMetadata(domain: LocalDataDomain): LocalDataMigrationValidationReport['recoveredMetadata'] {
  if (domain === 'chat') return { activeConversationId: `${domain}-object` };
  if (domain === 'collection') return { activeProjectId: `${domain}-object` };
  if (domain === 'persona') return { activeCollaboratorId: `${domain}-object` };
  return {};
}

function completeRow(domain: LocalDataDomain) {
  return createCompleteLocalDataRow({
    ref: { domain, kind: 'domainMeta', id: domain },
    value: { id: domain },
    version: 1,
    updatedAt: 100
  });
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
      providers: [provider({ id: 'runtime-object' })],
      activeProviderId: 'runtime-object',
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

function kvRowsFromUnit(unit: LocalDataUnitOfWork) {
  return unit.mutations.flatMap((mutation) => {
    if (mutation.type !== 'put' && mutation.type !== 'restore') return [];
    return [{ key: mutation.row.key, value: mutation.row }];
  });
}

function personaUnit() {
  return buildPersonaLocalDataUnitOfWork({
    version: 1,
    updatedAt: 100,
    state: {
      personas: [createPersonaTemplate({
        id: 'nova',
        name: 'Nova',
        description: ''
      })],
      activeCollaboratorId: 'nova',
      seededDefaultPersonaIds: []
    }
  });
}

function personaValidationReport(): LocalDataMigrationValidationReport {
  return {
    ...validationReport('persona'),
    legacyBaselineObjectIds: ['nova'],
    activeBaselineObjectIds: ['nova'],
    activeObjectIds: ['nova'],
    recoveredMetadata: {
      activeCollaboratorId: 'nova'
    }
  };
}

describe('buildLocalDataPromotionReadinessReport', () => {
  it('marks committed domains hydrate-ready only when their rows pass hydration preview', () => {
    const unit = runtimeUnit();
    const rows = kvRowsFromUnit(unit);
    const kv = [
      { key: getLocalDataCommitPointerKey('runtime'), value: pointer('runtime') },
      ...rows
    ];
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['runtime'],
      kv,
      censusReport: censusReport([domainReport('runtime', rows.map((row) => row.key))])
    });

    expect(report.canHydrate).toBe(true);
    expect(report.canPromote).toBe(false);
    expect(report.domains).toHaveLength(1);
    expect(report.domains.every((domain) => domain.status === 'staged')).toBe(true);
    expect(report.domains[0]).toEqual(expect.objectContaining({
      hydrationStatus: 'hydrated',
      hydrationObjectCount: 2,
      hydrationBlockers: [],
      remediation: [expect.objectContaining({
        scope: 'validation',
        code: 'validation-missing',
        nextAction: 'Run the runtime validation/readback path and attach its report before promotion.'
      })]
    }));
    expect(report.blockers).toEqual(['runtime:validation-missing']);
  });

  it('blocks complete rows that cannot hydrate into the domain store shape', () => {
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
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['runtime'],
      kv: [
        { key: getLocalDataCommitPointerKey('runtime'), value: pointer('runtime') },
        { key: row.key, value: row }
      ],
      censusReport: censusReport([domainReport('runtime', row.key)])
    });

    expect(report.canHydrate).toBe(false);
    expect(report.domains[0]).toEqual(expect.objectContaining({
      status: 'blocked',
      stageReady: false,
      hydrationStatus: 'blocked',
      hydrationBlockers: ['settings-row-count:0'],
      reasons: expect.arrayContaining([
        'hydration-blocked',
        'hydration-blocker:settings-row-count:0'
      ]),
      remediation: expect.arrayContaining([
        expect.objectContaining({
          scope: 'hydration',
          code: 'settings-row-count:0',
          nextAction: 'Fix the runtime row adapter or migration source so hydration preview passes before any active source switch.'
        })
      ])
    }));
  });

  it('still blocks promotion on a genuine census blocker even though asset tolerates incomplete rows', () => {
    const assetMetaRow = completeRow('asset');
    const incompleteAssetRow = createIncompleteLocalDataRow({
      ref: { domain: 'asset', kind: 'asset', id: 'asset-missing' },
      version: 1,
      updatedAt: 100,
      reason: 'missing-binary'
    });
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['asset'],
      kv: [
        { key: getLocalDataCommitPointerKey('asset'), value: pointer('asset') },
        { key: assetMetaRow.key, value: assetMetaRow },
        { key: incompleteAssetRow.key, value: incompleteAssetRow }
      ],
      censusReport: censusReport([
        domainReport('asset', [assetMetaRow.key, incompleteAssetRow.key])
      ], ['asset:missing-body'])
    });

    const asset = report.domains.find((domain) => domain.domain === 'asset');
    expect(report.canHydrate).toBe(false);
    expect(asset).toEqual(expect.objectContaining({
      status: 'blocked',
      stageReady: false,
      nonCompleteRowCount: 1,
      // The incomplete (missing-binary) asset row is a faithful record, NOT a hydration blocker.
      hydrationStatus: 'ledger-only',
      blockers: ['asset:missing-body'],
      reasons: expect.arrayContaining(['census-blocker:asset:missing-body'])
    }));
    // Asset is never blocked by its own incomplete rows — only by the genuine census blocker.
    expect(asset?.reasons).not.toContain('non-complete-rows');
  });

  it('keeps the asset domain stage-ready despite incomplete rows when there are no genuine blockers', () => {
    const assetMetaRow = completeRow('asset');
    const completeAssetRow = createCompleteLocalDataRow({
      ref: { domain: 'asset', kind: 'asset', id: 'asset-ok' },
      value: { id: 'asset-ok' },
      version: 1,
      updatedAt: 100
    });
    const incompleteAssetRow = createIncompleteLocalDataRow({
      ref: { domain: 'asset', kind: 'asset', id: 'asset-missing' },
      version: 1,
      updatedAt: 100,
      reason: 'missing-binary'
    });
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['asset'],
      kv: [
        { key: getLocalDataCommitPointerKey('asset'), value: pointer('asset') },
        { key: assetMetaRow.key, value: assetMetaRow },
        { key: completeAssetRow.key, value: completeAssetRow },
        { key: incompleteAssetRow.key, value: incompleteAssetRow }
      ],
      censusReport: censusReport([
        domainReport('asset', [assetMetaRow.key, completeAssetRow.key, incompleteAssetRow.key])
      ])
    });

    const asset = report.domains.find((domain) => domain.domain === 'asset');
    expect(asset).toEqual(expect.objectContaining({
      stageReady: true,
      nonCompleteRowCount: 1,
      hydrationStatus: 'ledger-only'
    }));
    expect(asset?.reasons).not.toContain('non-complete-rows');
  });

  it('marks a staged domain promotion-ready only after validation passes', () => {
    const row = completeRow('chat');
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['chat'],
      kv: [
        { key: getLocalDataCommitPointerKey('chat'), value: pointer('chat') },
        { key: row.key, value: row }
      ],
      censusReport: censusReport([domainReport('chat', row.key)]),
      validationReports: {
        chat: validationReport('chat')
      }
    });

    expect(report.canHydrate).toBe(true);
    expect(report.canPromote).toBe(true);
    expect(report.domains[0]).toEqual(expect.objectContaining({
      status: 'promotion_ready',
      stageReady: true,
      promotionReady: true,
      hydrationStatus: 'delegated',
      reasons: [],
      remediation: []
    }));
  });

  it('allows repaired source metadata blockers only when staging hydrates and validation proves recovery', () => {
    const unit = personaUnit();
    const rows = kvRowsFromUnit(unit);
    const personaDomainReport = {
      ...domainReport('persona', rows.map((row) => row.key)),
      baselineObjectIds: ['nova'],
      activeObjectIds: ['nova'],
      metadataIssueIds: ['activeCollaboratorId:missing-collaborator']
    };
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['persona'],
      kv: [
        { key: getLocalDataCommitPointerKey('persona'), value: pointer('persona') },
        ...rows
      ],
      censusReport: censusReport([personaDomainReport], ['persona:metadata-issue']),
      validationReports: {
        persona: personaValidationReport()
      }
    });

    expect(report.canHydrate).toBe(true);
    expect(report.canPromote).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.domains[0]).toEqual(expect.objectContaining({
      status: 'promotion_ready_with_source_issues',
      promotionReady: true,
      blockers: ['persona:metadata-issue'],
      reasons: [],
      remediation: []
    }));
  });

  it('keeps source content blockers blocking when the missing body is a domain object', () => {
    const unit = personaUnit();
    const rows = kvRowsFromUnit(unit);
    const personaDomainReport = {
      ...domainReport('persona', rows.map((row) => row.key)),
      baselineObjectIds: ['nova'],
      activeObjectIds: ['nova'],
      missingBodyObjectIds: ['nova']
    };
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['persona'],
      kv: [
        { key: getLocalDataCommitPointerKey('persona'), value: pointer('persona') },
        ...rows
      ],
      censusReport: censusReport([personaDomainReport], ['persona:missing-body']),
      validationReports: {
        persona: personaValidationReport()
      }
    });

    expect(report.canHydrate).toBe(false);
    expect(report.canPromote).toBe(false);
    expect(report.domains[0]).toEqual(expect.objectContaining({
      status: 'blocked',
      promotionReady: false,
      reasons: ['census-blocker:persona:missing-body'],
      remediation: [expect.objectContaining({
        scope: 'source',
        code: 'census-blocker'
      })]
    }));
  });

  it('allows detached persona document body blockers once the persona rows validate', () => {
    const unit = personaUnit();
    const rows = kvRowsFromUnit(unit);
    const personaDomainReport = {
      ...domainReport('persona', rows.map((row) => row.key)),
      baselineObjectIds: ['nova'],
      activeObjectIds: ['nova'],
      missingBodyObjectIds: ['nova:doc-missing']
    };
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['persona'],
      kv: [
        { key: getLocalDataCommitPointerKey('persona'), value: pointer('persona') },
        ...rows
      ],
      censusReport: censusReport([personaDomainReport], ['persona:missing-body']),
      validationReports: {
        persona: personaValidationReport()
      }
    });

    expect(report.canHydrate).toBe(true);
    expect(report.canPromote).toBe(true);
    expect(report.domains[0]).toEqual(expect.objectContaining({
      status: 'promotion_ready_with_source_issues',
      promotionReady: true,
      blockers: ['persona:missing-body'],
      reasons: [],
      remediation: []
    }));
  });

  it('allows source content blockers only when validation quarantines every affected object', () => {
    const row = completeRow('chat');
    const chatDomainReport = {
      ...domainReport('chat', row.key),
      baselineObjectIds: ['c-bad', 'c-good'],
      activeObjectIds: ['c-good'],
      missingBodyObjectIds: ['c-bad']
    };
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['chat'],
      kv: [
        { key: getLocalDataCommitPointerKey('chat'), value: pointer('chat') },
        { key: row.key, value: row }
      ],
      censusReport: censusReport([chatDomainReport], ['chat:missing-body']),
      validationReports: {
        chat: {
          ...validationReport('chat'),
          legacyBaselineCount: 2,
          legacyBaselineObjectIds: ['c-bad', 'c-good'],
          activeBaselineObjectIds: ['c-good'],
          activeObjectCount: 1,
          activeObjectIds: ['c-good'],
          quarantinedObjectCount: 1,
          quarantinedObjectIds: ['c-bad'],
          recoveredMetadata: {
            activeConversationId: 'c-good'
          }
        }
      }
    });

    expect(report.canHydrate).toBe(true);
    expect(report.canPromote).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.domains[0]).toEqual(expect.objectContaining({
      status: 'promotion_ready_with_source_issues',
      stageReady: true,
      promotionReady: true,
      blockers: ['chat:missing-body'],
      reasons: [],
      remediation: []
    }));
  });

  it('allows chat history promotion when only legacy attachment assets are missing', () => {
    const row = completeRow('chat');
    const chatDomainReport = {
      ...domainReport('chat', row.key),
      baselineObjectIds: ['c-kept'],
      activeObjectIds: ['c-kept'],
      assetRefIds: ['asset-missing'],
      missingAssetMetaRefIds: ['asset-missing'],
      missingAssetBinaryRefIds: ['asset-missing']
    };
    const report = buildLocalDataPromotionReadinessReport({
      domains: ['chat'],
      kv: [
        { key: getLocalDataCommitPointerKey('chat'), value: pointer('chat') },
        { key: row.key, value: row }
      ],
      censusReport: censusReport(
        [chatDomainReport],
        ['chat:missing-asset-meta', 'chat:missing-asset-binary']
      ),
      validationReports: {
        chat: {
          ...validationReport('chat'),
          legacyBaselineObjectIds: ['c-kept'],
          activeBaselineObjectIds: ['c-kept'],
          activeObjectIds: ['c-kept'],
          recoveredMetadata: {
            activeConversationId: 'c-kept'
          }
        }
      }
    });

    expect(report.canHydrate).toBe(true);
    expect(report.canPromote).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.domains[0]).toEqual(expect.objectContaining({
      status: 'promotion_ready_with_source_issues',
      stageReady: true,
      promotionReady: true,
      blockers: ['chat:missing-asset-meta', 'chat:missing-asset-binary'],
      reasons: [],
      remediation: []
    }));
  });
});
