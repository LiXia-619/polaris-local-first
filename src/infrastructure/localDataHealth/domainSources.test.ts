import { describe, expect, it } from 'vitest';
import { buildLocalDataDomainSources } from './domainSources';
import type { LocalDataCensusReport } from '../../engines/localData/localDataCensusReport';
import type { LocalDataCensusDomainReport } from '../../engines/localData/localDataCensusReportTypes';
import type { LocalDataPromotionReadinessReport } from '../../engines/localData/promotionReadiness';

const emptyDomainReport = (domain: LocalDataCensusDomainReport['domain']): LocalDataCensusDomainReport => ({
  domain,
  baselineObjectIds: [],
  activeObjectIds: [],
  repositoryRowKeys: [],
  legacySourceKeys: [],
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
});

// buildLocalDataDomainSources reads only `domains` + `activeDataSource`; keep the rest lean.
const census = (activeDataSource: LocalDataCensusReport['activeDataSource'], domains: LocalDataCensusDomainReport[]): LocalDataCensusReport => ({
  activeDataSource,
  domains
} as LocalDataCensusReport);

const readiness = (domains: LocalDataPromotionReadinessReport['domains']): LocalDataPromotionReadinessReport => ({
  domains
} as LocalDataPromotionReadinessReport);

// buildLocalDataDomainSources reads only the listed readiness fields; cast a lean partial.
type ReadinessDomain = LocalDataPromotionReadinessReport['domains'][number];
const readinessDomain = (fields: Pick<
  ReadinessDomain,
  'domain' | 'status' | 'stageReady' | 'promotionReady' | 'rowCount' | 'completeRowCount' | 'nonCompleteRowCount' | 'hydrationStatus' | 'blockers' | 'hydrationBlockers'
>): ReadinessDomain => fields as unknown as ReadinessDomain;

describe('buildLocalDataDomainSources', () => {
  it('emits one entry per domain in fixed order', () => {
    const result = buildLocalDataDomainSources({
      censusReport: census('unknown', []),
      promotionReadiness: readiness([])
    });
    expect(result.map((entry) => entry.domain)).toEqual([
      'chat', 'collection', 'persona', 'runtime', 'space', 'asset', 'document'
    ]);
  });

  it('reports live chat LocalData separately from empty domains', () => {
    const chatReport = { ...emptyDomainReport('chat'), activeObjectIds: ['c-1'], baselineObjectIds: ['c-1'] };
    const result = buildLocalDataDomainSources({
      censusReport: census('unknown', [chatReport]),
      promotionReadiness: readiness([])
    });
    expect(result.find((entry) => entry.domain === 'chat')).toEqual(expect.objectContaining({
      status: 'local-data-live',
      activeObjectCount: 1,
      issueCount: 0
    }));
    expect(result.find((entry) => entry.domain === 'collection')).toEqual(expect.objectContaining({
      status: 'empty',
      objectCount: 0
    }));
  });

  it('marks repository source active and still surfaces non-complete staging rows as an issue', () => {
    const collectionReport = { ...emptyDomainReport('collection'), repositoryRowKeys: ['row-1'] };
    const result = buildLocalDataDomainSources({
      censusReport: census('repository', [collectionReport]),
      promotionReadiness: readiness([readinessDomain({
        domain: 'collection',
        status: 'staged',
        hydrationStatus: 'hydrated',
        stageReady: true,
        promotionReady: false,
        rowCount: 1,
        completeRowCount: 0,
        nonCompleteRowCount: 1,
        blockers: [],
        hydrationBlockers: []
      })])
    });
    const collection = result.find((entry) => entry.domain === 'collection');
    expect(collection?.status).toBe('repository-active');
    expect(collection?.repositoryRowCount).toBe(1);
    expect(collection?.issues).toContain('非完整暂存行 1');
  });

  it('treats asset and document domains as ledger-only when evidence exists', () => {
    const assetReport = { ...emptyDomainReport('asset'), baselineObjectIds: ['asset-1'] };
    const result = buildLocalDataDomainSources({
      censusReport: census('repository', [assetReport]),
      promotionReadiness: readiness([])
    });
    expect(result.find((entry) => entry.domain === 'asset')?.status).toBe('ledger-only');
    expect(result.find((entry) => entry.domain === 'document')?.status).toBe('empty');
  });
});
