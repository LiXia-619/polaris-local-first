import {
  readLocalDataCensusReportForKv,
  readLocalDataPromotionReadinessKvEntries
} from './localDataHealth';
import {
  buildLocalDataPromotionReadinessReport,
  type LocalDataPromotionReadinessReport
} from '../engines/localData/promotionReadiness';
import {
  buildLocalDataStoreHydrationValidationReports,
  type LocalDataStoreHydrationValidationReports
} from '../engines/localData/storeHydrationValidation';
import type { LocalDataDomain, LocalDataMigrationValidationReport } from '../engines/localData/types';
import { readPersistedLocalDataMigrationValidationReports } from './localDataMigrationValidationEvidence';

export type LocalDataPromotionReadinessEvidence = {
  readiness: LocalDataPromotionReadinessReport;
  validationReports: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>>;
  validationFailures: LocalDataStoreHydrationValidationReports['failures'];
};

export async function readLocalDataPromotionReadinessEvidence(args: {
  validationReports?: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>>;
  autoValidateStoreDomains?: boolean;
  domains?: LocalDataDomain[];
} = {}): Promise<LocalDataPromotionReadinessEvidence> {
  const kv = await readLocalDataPromotionReadinessKvEntries();
  const censusReport = await readLocalDataCensusReportForKv(kv);
  const storeValidation = args.autoValidateStoreDomains === false
    ? { validationReports: {}, failures: {} }
    : buildLocalDataStoreHydrationValidationReports({
      kv,
      censusDomains: censusReport.domains,
      domains: args.domains,
      validatedAt: Date.now()
    });
  const persistedValidationReports = await readPersistedLocalDataMigrationValidationReports();
  const validationReports = {
    ...persistedValidationReports,
    ...storeValidation.validationReports,
    ...args.validationReports
  };
  const readiness = buildLocalDataPromotionReadinessReport({
    kv,
    censusReport,
    validationReports,
    domains: args.domains
  });

  return {
    readiness,
    validationReports,
    validationFailures: storeValidation.failures
  };
}

export async function readLocalDataPromotionReadinessReport(args: {
  validationReports?: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>>;
  autoValidateStoreDomains?: boolean;
  domains?: LocalDataDomain[];
} = {}): Promise<LocalDataPromotionReadinessReport> {
  const evidence = await readLocalDataPromotionReadinessEvidence(args);
  return evidence.readiness;
}
