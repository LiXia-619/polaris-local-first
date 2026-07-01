import {
  readLocalDataCensusReportForKv,
  readLocalDataPromotionReadinessKvEntries
} from '../infrastructure/localDataHealth';
import { readPersistedLocalDataMigrationValidationReports } from '../infrastructure/localDataMigrationValidationEvidence';
import {
  buildLocalDataPromotionReadinessReport,
  LOCAL_DATA_PROMOTION_DOMAIN_ORDER,
  type LocalDataPromotionReadinessReport
} from '../engines/localData/promotionReadiness';
import {
  buildLocalDataStoreHydrationValidationReports
} from '../engines/localData/storeHydrationValidation';
import {
  createLocalDataRepository,
  createStagedLocalDataKvBackendForMigration,
  type LocalDataActiveDataSourceRow,
  type LocalDataDomain,
  type LocalDataMigrationValidationReport
} from '../engines/localData';

export const LOCAL_DATA_LIVE_SOURCE_DOMAINS = [
  'chat',
  'collection',
  'persona',
  'runtime',
  'space',
  'document',
  'asset'
] satisfies LocalDataDomain[];

export type LocalDataLiveSourcePromotionResult = {
  requestedDomains: LocalDataDomain[];
  domains: LocalDataDomain[];
  skippedDomains: LocalDataLiveSourcePromotionSkippedDomain[];
  readiness: LocalDataPromotionReadinessReport;
  activeDataSource: LocalDataActiveDataSourceRow;
};

export type LocalDataLiveSourcePromotionSkippedDomain = {
  domain: LocalDataDomain;
  status: string;
  reasons: string[];
};

export async function promoteLocalDataLiveSourceDomains(args: {
  domains?: LocalDataDomain[];
  validationReports?: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>>;
} = {}): Promise<LocalDataLiveSourcePromotionResult> {
  const requestedDomains = orderedUniqueDomains(args.domains ?? LOCAL_DATA_LIVE_SOURCE_DOMAINS);
  const [kv, persistedValidationReports] = await Promise.all([
    readLocalDataPromotionReadinessKvEntries(),
    readPersistedLocalDataMigrationValidationReports()
  ]);
  const censusReport = await readLocalDataCensusReportForKv(kv);
  const storeValidation = buildLocalDataStoreHydrationValidationReports({
    kv,
    censusDomains: censusReport.domains,
    validatedAt: Date.now()
  });
  const validationReports = {
    ...persistedValidationReports,
    ...storeValidation.validationReports,
    ...(args.validationReports ?? {})
  };
  const readiness = buildLocalDataPromotionReadinessReport({
    kv,
    censusReport,
    validationReports,
    domains: requestedDomains
  });
  const skippedDomains: LocalDataLiveSourcePromotionSkippedDomain[] = [];
  const promotions = requestedDomains.flatMap((domain) => {
    const domainReadiness = readiness.domains.find((entry) => entry.domain === domain);
    if (!domainReadiness?.promotionReady || !domainReadiness.pointer) {
      skippedDomains.push({
        domain,
        status: domainReadiness?.status ?? 'not_committed',
        reasons: domainReadiness?.reasons ?? ['missing-readiness']
      });
      return [];
    }
    const validationReport = validationReports[domain];
    if (!validationReport) {
      skippedDomains.push({
        domain,
        status: domainReadiness.status,
        reasons: ['validation-report-missing']
      });
      return [];
    }
    return [{
      meta: {
        domain,
        version: domainReadiness.pointer.version,
        committedAt: domainReadiness.pointer.committedAt,
        commitId: domainReadiness.pointer.commitId
      },
      validationReport
    }];
  });
  if (promotions.length === 0) {
    throw new Error(`No LocalData live source domains are promotion-ready: ${skippedDomains.map((entry) => `${entry.domain}:${entry.reasons.join('|')}`).join(', ')}`);
  }

  const repository = createLocalDataRepository({
    backend: createStagedLocalDataKvBackendForMigration()
  });
  const activeDataSource = await repository.promoteActiveDataSources(promotions);

  return {
    requestedDomains,
    domains: promotions.map((promotion) => promotion.meta.domain),
    skippedDomains,
    readiness,
    activeDataSource
  };
}

function orderedUniqueDomains(domains: LocalDataDomain[]) {
  const requested = new Set(domains);
  return LOCAL_DATA_PROMOTION_DOMAIN_ORDER.filter((domain) => requested.has(domain));
}
