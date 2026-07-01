import type { LocalDataDomain } from '../../engines/localData/types';
import type { LocalDataCensusReport } from '../../engines/localData/localDataCensusReport';
import type { LocalDataCensusDomainReport } from '../../engines/localData/localDataCensusReportTypes';
import type { LocalDataPromotionReadinessReport } from '../../engines/localData/promotionReadiness';

export type LocalDataDomainSourceStatus =
  | 'repository-active'
  | 'local-data-live'
  | 'repository-staged'
  | 'legacy-fallback'
  | 'ledger-only'
  | 'empty';

export type LocalDataDomainSourceHealth = {
  domain: LocalDataDomain;
  label: string;
  status: LocalDataDomainSourceStatus;
  statusLabel: string;
  objectCount: number;
  activeObjectCount: number;
  repositoryRowCount: number;
  legacySourceCount: number;
  readinessStatus: string;
  issueCount: number;
  issues: string[];
  evidence: string[];
};

const DOMAIN_SOURCE_ORDER: LocalDataDomain[] = [
  'chat',
  'collection',
  'persona',
  'runtime',
  'space',
  'asset',
  'document'
];

const DOMAIN_SOURCE_LABELS: Record<LocalDataDomain, string> = {
  asset: '附件实体',
  chat: '对话',
  collection: '作品与资料',
  document: '长正文',
  persona: '协作者',
  runtime: '服务配置',
  space: '界面状态'
};

const DOMAIN_SOURCE_STATUS_LABELS: Record<LocalDataDomainSourceStatus, string> = {
  'repository-active': 'repository 当前事实源',
  'local-data-live': 'LocalData 直读',
  'repository-staged': 'repository 暂存未切源',
  'legacy-fallback': 'legacy/旧链路兜底',
  'ledger-only': '账本只读',
  empty: '未发现本地数据'
};

function issueLine(count: number, label: string) {
  return count > 0 ? `${label} ${count}` : null;
}

function buildDomainSourceIssues(
  domainReport: LocalDataCensusDomainReport | undefined,
  readiness: LocalDataPromotionReadinessReport['domains'][number] | undefined
) {
  const issues = [
    issueLine(domainReport?.missingBodyObjectIds.length ?? 0, '缺正文'),
    issueLine(domainReport?.orphanBodyObjectIds.length ?? 0, '孤儿正文'),
    issueLine(
      (domainReport?.missingOwnerObjectIds.length ?? 0)
        + (domainReport?.unresolvedOwnerObjectIds.length ?? 0)
        + (domainReport?.danglingOwnerObjectIds.length ?? 0),
      '归属异常'
    ),
    issueLine(
      (domainReport?.missingAssetMetaRefIds.length ?? 0)
        + (domainReport?.missingAssetBinaryRefIds.length ?? 0),
      '附件断链'
    ),
    issueLine(domainReport?.metadataIssueIds.length ?? 0, '元数据异常'),
    readiness && readiness.nonCompleteRowCount > 0 ? `非完整暂存行 ${readiness.nonCompleteRowCount}` : null,
    readiness && readiness.blockers.length > 0 ? `切源阻断 ${readiness.blockers.length}` : null,
    readiness && readiness.hydrationBlockers.length > 0 ? `hydrate 阻断 ${readiness.hydrationBlockers.length}` : null
  ].filter((issue): issue is string => Boolean(issue));

  return Array.from(new Set(issues));
}

function resolveDomainSourceStatus(args: {
  domain: LocalDataDomain;
  censusReport: LocalDataCensusReport;
  domainReport: LocalDataCensusDomainReport | undefined;
  readiness: LocalDataPromotionReadinessReport['domains'][number] | undefined;
}): LocalDataDomainSourceStatus {
  const activeObjects = args.domainReport?.activeObjectIds.length ?? 0;
  const baselineObjects = args.domainReport?.baselineObjectIds.length ?? 0;
  const repositoryRows = args.domainReport?.repositoryRowKeys.length ?? args.readiness?.rowCount ?? 0;
  const legacySources = args.domainReport?.legacySourceKeys.length ?? 0;
  const hasAnyDomainEvidence = activeObjects + baselineObjects + repositoryRows + legacySources > 0;

  if (args.domain === 'asset' || args.domain === 'document') {
    return hasAnyDomainEvidence ? 'ledger-only' : 'empty';
  }
  if (args.censusReport.activeDataSource === 'repository' && hasAnyDomainEvidence) return 'repository-active';
  if (args.domain === 'chat' && activeObjects > 0) return 'local-data-live';
  if (args.readiness?.stageReady || args.readiness?.promotionReady || repositoryRows > 0) return 'repository-staged';
  if (legacySources > 0 || activeObjects > 0 || baselineObjects > 0) return 'legacy-fallback';
  return 'empty';
}

function buildDomainSourceEvidence(args: {
  activeObjects: number;
  objectCount: number;
  repositoryRows: number;
  legacySources: number;
  readiness: LocalDataPromotionReadinessReport['domains'][number] | undefined;
}) {
  const evidence = [
    `activeObjects ${args.activeObjects}`,
    `baselineObjects ${args.objectCount}`,
    `repositoryRows ${args.repositoryRows}`,
    `legacySources ${args.legacySources}`
  ];

  if (args.readiness) {
    evidence.push(
      `readiness ${args.readiness.status}`,
      `rows ${args.readiness.completeRowCount}/${args.readiness.rowCount}`,
      `hydration ${args.readiness.hydrationStatus}`
    );
  }

  return evidence;
}

export function buildLocalDataDomainSources(args: {
  censusReport: LocalDataCensusReport;
  promotionReadiness: LocalDataPromotionReadinessReport;
}): LocalDataDomainSourceHealth[] {
  return DOMAIN_SOURCE_ORDER.map((domain) => {
    const domainReport = args.censusReport.domains.find((entry) => entry.domain === domain);
    const readiness = args.promotionReadiness.domains.find((entry) => entry.domain === domain);
    const activeObjectCount = domainReport?.activeObjectIds.length ?? 0;
    const objectCount = domainReport?.baselineObjectIds.length ?? 0;
    const repositoryRowCount = domainReport?.repositoryRowKeys.length ?? readiness?.rowCount ?? 0;
    const legacySourceCount = domainReport?.legacySourceKeys.length ?? 0;
    const status = resolveDomainSourceStatus({
      domain,
      censusReport: args.censusReport,
      domainReport,
      readiness
    });
    const issues = buildDomainSourceIssues(domainReport, readiness);

    return {
      domain,
      label: DOMAIN_SOURCE_LABELS[domain],
      status,
      statusLabel: DOMAIN_SOURCE_STATUS_LABELS[status],
      objectCount,
      activeObjectCount,
      repositoryRowCount,
      legacySourceCount,
      readinessStatus: readiness?.status ?? 'not_checked',
      issueCount: issues.length,
      issues,
      evidence: buildDomainSourceEvidence({
        activeObjects: activeObjectCount,
        objectCount,
        repositoryRows: repositoryRowCount,
        legacySources: legacySourceCount,
        readiness
      })
    };
  });
}
