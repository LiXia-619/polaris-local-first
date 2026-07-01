import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCompleteLocalDataRow,
  getLocalDataCommitPointerKey,
  type CommitPointerRow,
  type LocalDataCensusDomainReport,
  type LocalDataCensusReport,
  type LocalDataDomain
} from '../engines/localData';
import { buildLocalDataStoreHydrationValidationReports } from '../engines/localData/storeHydrationValidation';
import { readPersistedLocalDataMigrationValidationReports } from './localDataMigrationValidationEvidence';
import {
  readLocalDataCensusReportForKv,
  readLocalDataPromotionReadinessKvEntries
} from './localDataHealth';
import { readLocalDataPromotionReadinessEvidence } from './localDataPromotionReadiness';

vi.mock('./localDataHealth', () => ({
  readLocalDataCensusReportForKv: vi.fn(),
  readLocalDataPromotionReadinessKvEntries: vi.fn()
}));

vi.mock('./localDataMigrationValidationEvidence', () => ({
  readPersistedLocalDataMigrationValidationReports: vi.fn()
}));

vi.mock('../engines/localData/storeHydrationValidation', () => ({
  buildLocalDataStoreHydrationValidationReports: vi.fn()
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readPersistedLocalDataMigrationValidationReports).mockResolvedValue({});
  vi.mocked(buildLocalDataStoreHydrationValidationReports).mockReturnValue({
    validationReports: {},
    failures: {}
  });
});

describe('readLocalDataPromotionReadinessEvidence', () => {
  it('reuses the selected promotion KV snapshot for census and readiness', async () => {
    const row = createCompleteLocalDataRow({
      ref: { domain: 'runtime', kind: 'domainMeta', id: 'runtime' },
      value: { id: 'runtime' },
      version: 1,
      updatedAt: 100
    });
    const kv = [
      { key: getLocalDataCommitPointerKey('runtime'), value: pointer('runtime') },
      { key: row.key, value: row }
    ];
    vi.mocked(readLocalDataPromotionReadinessKvEntries).mockResolvedValue(kv);
    vi.mocked(readLocalDataCensusReportForKv).mockResolvedValue(censusReport([
      domainReport('runtime', [row.key])
    ]));

    const result = await readLocalDataPromotionReadinessEvidence({
      autoValidateStoreDomains: false
    });

    expect(readLocalDataPromotionReadinessKvEntries).toHaveBeenCalledTimes(1);
    expect(readLocalDataCensusReportForKv).toHaveBeenCalledTimes(1);
    expect(readLocalDataCensusReportForKv).toHaveBeenCalledWith(kv);
    expect(result.readiness.domains.find((domain) => domain.domain === 'runtime')).toEqual(expect.objectContaining({
      rowCount: 1
    }));
  });
});
