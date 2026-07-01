import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCompleteLocalDataRow,
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  type CommitPointerRow,
  type LocalDataCensusDomainReport,
  type LocalDataCensusReport,
  type LocalDataDomain,
  type LocalDataMigrationValidationReport
} from '../engines/localData';
import { buildLocalDataStoreHydrationValidationReports } from '../engines/localData/storeHydrationValidation';
import {
  readLocalDataCensusReportForKv,
  readLocalDataPromotionReadinessKvEntries
} from '../infrastructure/localDataHealth';
import { readPersistedLocalDataMigrationValidationReports } from '../infrastructure/localDataMigrationValidationEvidence';
import {
  LOCAL_DATA_LIVE_SOURCE_DOMAINS,
  promoteLocalDataLiveSourceDomains
} from './localDataSourcePromotionPersistence';

const { promoteActiveDataSourcesMock } = vi.hoisted(() => ({
  promoteActiveDataSourcesMock: vi.fn()
}));

vi.mock('../infrastructure/localDataHealth', () => ({
  readLocalDataCensusReportForKv: vi.fn(),
  readLocalDataPromotionReadinessKvEntries: vi.fn()
}));
vi.mock('../infrastructure/localDataMigrationValidationEvidence', () => ({
  readPersistedLocalDataMigrationValidationReports: vi.fn()
}));

vi.mock('../engines/localData/storeHydrationValidation', () => ({
  buildLocalDataStoreHydrationValidationReports: vi.fn()
}));

vi.mock('../engines/localData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engines/localData')>();
  return {
    ...actual,
    createLocalDataRepository: vi.fn(() => ({
      promoteActiveDataSources: promoteActiveDataSourcesMock
    })),
    createStagedLocalDataKvBackendForMigration: vi.fn(() => ({
      mode: 'staged'
    }))
  };
});

function pointer(domain: LocalDataDomain): CommitPointerRow {
  return {
    domain,
    version: 1,
    committedAt: 100,
    commitId: `${domain}-commit`
  };
}

function domainReport(domain: LocalDataDomain, rowKeys: string[]): LocalDataCensusDomainReport {
  return {
    domain,
    baselineObjectIds: [`${domain}-object`],
    activeObjectIds: [`${domain}-object`],
    repositoryRowKeys: rowKeys,
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

function censusReport(domains: LocalDataCensusDomainReport[]): LocalDataCensusReport {
  return {
    ok: true,
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
    blockers: [],
    warnings: []
  };
}

function validationReport(domain: LocalDataDomain): LocalDataMigrationValidationReport {
  return {
    id: `${domain}:validation`,
    domain,
    commitId: `${domain}-commit`,
    version: 1,
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
    recoveredMetadata: domain === 'chat' ? { activeConversationId: `${domain}-object` } : {}
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readPersistedLocalDataMigrationValidationReports).mockResolvedValue({});
  vi.mocked(buildLocalDataStoreHydrationValidationReports).mockReturnValue({
    validationReports: {},
    failures: {}
  });
  promoteActiveDataSourcesMock.mockImplementation(async (promotions: Array<{ meta: CommitPointerRow }>) => ({
    schemaVersion: 1,
    key: getLocalDataActiveDataSourceKey(),
    activeDataSource: 'repository',
    activeCommitId: promotions[promotions.length - 1]?.meta.commitId ?? null,
    stagingCommitId: null,
    updatedAt: 200,
    domains: Object.fromEntries(promotions.map((promotion) => [
      promotion.meta.domain,
      promotion.meta
    ]))
  }));
});

describe('promoteLocalDataLiveSourceDomains', () => {
  it('includes chat in the default live-source promotion domains', () => {
    expect(LOCAL_DATA_LIVE_SOURCE_DOMAINS).toEqual(['chat', 'collection', 'persona', 'runtime', 'space', 'document', 'asset']);
  });

  it('runs default live-source promotion through chat and skips unready store domains', async () => {
    const chatRow = createCompleteLocalDataRow({
      ref: { domain: 'chat', kind: 'domainMeta', id: 'chat' },
      value: { id: 'chat' },
      version: 1,
      updatedAt: 100
    });
    vi.mocked(readLocalDataPromotionReadinessKvEntries).mockResolvedValue([
      { key: getLocalDataCommitPointerKey('chat'), value: pointer('chat') },
      { key: chatRow.key, value: chatRow }
    ]);
    vi.mocked(readLocalDataCensusReportForKv).mockResolvedValue(censusReport([
      domainReport('chat', [chatRow.key])
    ]));

    const result = await promoteLocalDataLiveSourceDomains({
      validationReports: {
        chat: validationReport('chat')
      }
    });

    expect(promoteActiveDataSourcesMock).toHaveBeenCalledTimes(1);
    expect((promoteActiveDataSourcesMock.mock.calls[0][0] as Array<{ meta: CommitPointerRow }>)
      .map((promotion) => promotion.meta.domain)).toEqual(['chat']);
    expect(result.requestedDomains).toEqual(['chat', 'collection', 'persona', 'runtime', 'space', 'asset', 'document']);
    expect(result.domains).toEqual(['chat']);
    expect(result.skippedDomains.map((entry) => entry.domain)).toEqual(['collection', 'persona', 'runtime', 'space', 'asset', 'document']);
    expect(result.skippedDomains.every((entry) => (
      entry.status === 'not_committed'
      && entry.reasons.includes('missing-pointer')
      && entry.reasons.includes('missing-repository-rows')
    ))).toBe(true);
  });

  it('promotes ready domains and leaves blocked requested domains on their previous source', async () => {
    const row = createCompleteLocalDataRow({
      ref: { domain: 'chat', kind: 'domainMeta', id: 'chat' },
      value: { id: 'chat' },
      version: 1,
      updatedAt: 100
    });
    vi.mocked(readLocalDataPromotionReadinessKvEntries).mockResolvedValue([
      { key: getLocalDataCommitPointerKey('chat'), value: pointer('chat') },
      { key: row.key, value: row }
    ]);
    vi.mocked(readLocalDataCensusReportForKv).mockResolvedValue(censusReport([
      domainReport('chat', [row.key])
    ]));

    const result = await promoteLocalDataLiveSourceDomains({
      domains: ['chat', 'runtime'],
      validationReports: {
        chat: validationReport('chat')
      }
    });

    expect(promoteActiveDataSourcesMock).toHaveBeenCalledTimes(1);
    expect(promoteActiveDataSourcesMock.mock.calls[0][0]).toHaveLength(1);
    expect(promoteActiveDataSourcesMock.mock.calls[0][0][0].meta.domain).toBe('chat');
    expect(result.requestedDomains).toEqual(['chat', 'runtime']);
    expect(result.domains).toEqual(['chat']);
    expect(result.activeDataSource.domains.chat?.commitId).toBe('chat-commit');
    expect(result.skippedDomains).toEqual([{
      domain: 'runtime',
      status: 'not_committed',
      reasons: ['missing-pointer', 'missing-repository-rows']
    }]);
  });

  it('uses persisted chat validation evidence when promotion runs after staging returned', async () => {
    const row = createCompleteLocalDataRow({
      ref: { domain: 'chat', kind: 'domainMeta', id: 'chat' },
      value: { id: 'chat' },
      version: 1,
      updatedAt: 100
    });
    vi.mocked(readLocalDataPromotionReadinessKvEntries).mockResolvedValue([
      { key: getLocalDataCommitPointerKey('chat'), value: pointer('chat') },
      { key: row.key, value: row }
    ]);
    vi.mocked(readLocalDataCensusReportForKv).mockResolvedValue(censusReport([
      domainReport('chat', [row.key])
    ]));
    vi.mocked(readPersistedLocalDataMigrationValidationReports).mockResolvedValue({
      chat: validationReport('chat')
    });

    const result = await promoteLocalDataLiveSourceDomains({
      domains: ['chat']
    });

    expect(promoteActiveDataSourcesMock).toHaveBeenCalledTimes(1);
    expect(promoteActiveDataSourcesMock.mock.calls[0][0][0]).toEqual(expect.objectContaining({
      meta: expect.objectContaining({
        domain: 'chat',
        commitId: 'chat-commit'
      })
    }));
    expect(result.domains).toEqual(['chat']);
  });

  it('promotes the document domain when its rows and validation evidence are ready', async () => {
    const row = createCompleteLocalDataRow({
      ref: { domain: 'document', kind: 'domainMeta', id: 'document' },
      value: { id: 'document' },
      version: 1,
      updatedAt: 100
    });
    vi.mocked(readLocalDataPromotionReadinessKvEntries).mockResolvedValue([
      { key: getLocalDataCommitPointerKey('document'), value: pointer('document') },
      { key: row.key, value: row }
    ]);
    vi.mocked(readLocalDataCensusReportForKv).mockResolvedValue(censusReport([
      domainReport('document', [row.key])
    ]));

    const result = await promoteLocalDataLiveSourceDomains({
      domains: ['document'],
      validationReports: {
        document: validationReport('document')
      }
    });

    expect(promoteActiveDataSourcesMock).toHaveBeenCalledTimes(1);
    expect(promoteActiveDataSourcesMock.mock.calls[0][0][0]).toEqual(expect.objectContaining({
      meta: expect.objectContaining({
        domain: 'document',
        commitId: 'document-commit'
      })
    }));
    expect(result.domains).toEqual(['document']);
  });

  it('reports every skipped live domain while promoting the ready subset', async () => {
    const row = createCompleteLocalDataRow({
      ref: { domain: 'chat', kind: 'domainMeta', id: 'chat' },
      value: { id: 'chat' },
      version: 1,
      updatedAt: 100
    });
    vi.mocked(readLocalDataPromotionReadinessKvEntries).mockResolvedValue([
      { key: getLocalDataCommitPointerKey('chat'), value: pointer('chat') },
      { key: row.key, value: row }
    ]);
    vi.mocked(readLocalDataCensusReportForKv).mockResolvedValue(censusReport([
      domainReport('chat', [row.key])
    ]));

    const result = await promoteLocalDataLiveSourceDomains({
      domains: ['chat', 'collection', 'persona', 'runtime', 'space'],
      validationReports: {
        chat: validationReport('chat')
      }
    });

    const promotions = promoteActiveDataSourcesMock.mock.calls[0][0] as Array<{ meta: CommitPointerRow }>;
    expect(promoteActiveDataSourcesMock).toHaveBeenCalledTimes(1);
    expect(promotions.map((promotion) => promotion.meta.domain)).toEqual(['chat']);
    expect(result.requestedDomains).toEqual(['chat', 'collection', 'persona', 'runtime', 'space']);
    expect(result.domains).toEqual(['chat']);
    expect(result.skippedDomains.map((entry) => entry.domain)).toEqual(['collection', 'persona', 'runtime', 'space']);
    expect(result.skippedDomains.every((entry) => (
      entry.status === 'not_committed'
      && entry.reasons.includes('missing-pointer')
      && entry.reasons.includes('missing-repository-rows')
    ))).toBe(true);
  });

  it('does not publish an active source row when no requested domain is ready', async () => {
    vi.mocked(readLocalDataPromotionReadinessKvEntries).mockResolvedValue([]);
    vi.mocked(readLocalDataCensusReportForKv).mockResolvedValue(censusReport([]));

    await expect(promoteLocalDataLiveSourceDomains({
      domains: ['runtime']
    })).rejects.toThrow('No LocalData live source domains are promotion-ready');

    expect(promoteActiveDataSourcesMock).not.toHaveBeenCalled();
  });
});
