import { kvGet, kvSet, type PersistedDbEntry } from './persistence';
import type {
  LocalDataDomain,
  LocalDataMigrationValidationReport
} from '../engines/localData/types';

const VALIDATION_REPORT_KEY_PREFIX = 'local-data-v1:migration-validation-report:';
const VALIDATION_REPORT_DOMAINS: LocalDataDomain[] = [
  'chat',
  'collection',
  'persona',
  'runtime',
  'space',
  'asset',
  'document'
];

export function getLocalDataMigrationValidationReportKey(domain: LocalDataDomain) {
  return `${VALIDATION_REPORT_KEY_PREFIX}${domain}`;
}

export async function writeLocalDataMigrationValidationReport(
  report: LocalDataMigrationValidationReport
) {
  await kvSet(getLocalDataMigrationValidationReportKey(report.domain), report);
}

export async function readPersistedLocalDataMigrationValidationReports(
  domains: LocalDataDomain[] = VALIDATION_REPORT_DOMAINS
): Promise<Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>>> {
  const reports: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>> = {};
  await Promise.all(domains.map(async (domain) => {
    const report = await kvGet<unknown>(getLocalDataMigrationValidationReportKey(domain));
    if (isLocalDataMigrationValidationReport(report, domain)) reports[domain] = report;
  }));
  return reports;
}

export function readPersistedLocalDataMigrationValidationReportsFromEntries(
  entries: PersistedDbEntry[],
  domains: LocalDataDomain[] = VALIDATION_REPORT_DOMAINS
): Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>> {
  const reports: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>> = {};
  for (const domain of domains) {
    const report = entries.find((entry) => entry.key === getLocalDataMigrationValidationReportKey(domain))?.value;
    if (isLocalDataMigrationValidationReport(report, domain)) reports[domain] = report;
  }
  return reports;
}

function isLocalDataMigrationValidationReport(
  value: unknown,
  domain: LocalDataDomain
): value is LocalDataMigrationValidationReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const report = value as Partial<LocalDataMigrationValidationReport>;
  return report.domain === domain
    && typeof report.id === 'string'
    && typeof report.commitId === 'string'
    && typeof report.version === 'number'
    && typeof report.validatedAt === 'number'
    && typeof report.stagingHydrated === 'boolean'
    && typeof report.legacyBaselineCount === 'number'
    && Array.isArray(report.legacyBaselineObjectIds)
    && Array.isArray(report.activeBaselineObjectIds)
    && typeof report.activeObjectCount === 'number'
    && Array.isArray(report.activeObjectIds)
    && typeof report.quarantinedObjectCount === 'number'
    && Array.isArray(report.quarantinedObjectIds)
    && typeof report.duplicateObjectIdCount === 'number'
    && typeof report.missingActiveCollaboratorIdCount === 'number'
    && Array.isArray(report.missingActiveCollaboratorIds)
    && typeof report.activeIncompleteRowCount === 'number'
    && typeof report.activeTimedOutRowCount === 'number'
    && Boolean(report.recoveredMetadata && typeof report.recoveredMetadata === 'object');
}
