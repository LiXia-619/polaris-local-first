import type { LocalDataCensusDomainReport } from './localDataCensusReportTypes';
import {
  LocalDataMigrationValidationError,
  assertValidMigrationPromotionReport
} from './migrationValidation';
import type {
  CollectionHydrationPreview,
  LocalDataStoreHydrationPreviewEntry,
  LocalDataStoreHydrationPreview,
  PersonaHydrationPreview
} from './storeHydrationPreview';
import { previewLocalDataStoreHydration } from './storeHydrationPreview';
import type {
  CommitPointerRow,
  LocalDataDomain,
  LocalDataMigrationValidationReport
} from './types';
import { getLocalDataCommitPointerKey } from './types';

export type LocalDataStoreHydrationValidationArgs = {
  pointer: CommitPointerRow;
  censusDomainReport: LocalDataCensusDomainReport;
  hydrationPreview: Exclude<LocalDataStoreHydrationPreview, { domain: 'chat' }>;
  validatedAt: number;
};

export type LocalDataStoreHydrationValidationReports = {
  validationReports: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>>;
  failures: Partial<Record<Exclude<LocalDataDomain, 'chat'>, string>>;
};

const STORE_VALIDATION_DOMAINS: Array<Exclude<LocalDataDomain, 'chat'>> = [
  'collection',
  'persona',
  'runtime',
  'space',
  'asset',
  'document'
];

export function buildLocalDataStoreHydrationValidationReport(
  args: LocalDataStoreHydrationValidationArgs
): LocalDataMigrationValidationReport {
  if (args.pointer.domain === 'chat') {
    throw new LocalDataMigrationValidationError('Chat validation must use the chat-specific hydration validation path.');
  }
  if (args.pointer.domain !== args.censusDomainReport.domain || args.pointer.domain !== args.hydrationPreview.domain) {
    throw new LocalDataMigrationValidationError('LocalData store hydration validation inputs do not describe the same domain.');
  }
  if (!isPreviewValidationReady(args.hydrationPreview)) {
    throw new LocalDataMigrationValidationError(`LocalData ${args.pointer.domain} hydration preview is not validation-ready.`);
  }

  const legacyBaselineObjectIds = uniqueSortedIds(args.censusDomainReport.baselineObjectIds);
  const quarantineIssueIds = collectQuarantineIssueIds(args.censusDomainReport);
  const activeObjectIds = uniqueSortedIds(
    args.censusDomainReport.activeObjectIds.filter((id) => !quarantineIssueIds.has(id))
  );
  const quarantinedObjectIds = uniqueSortedIds(
    [
      ...legacyBaselineObjectIds.filter((id) => !activeObjectIds.includes(id)),
      ...quarantineIssueIds
    ]
  );
  const missingActiveCollaboratorIds = uniqueSortedIds(args.censusDomainReport.missingOwnerObjectIds);
  const metadata = resolveRecoveredMetadata(args.hydrationPreview, activeObjectIds);
  const metadataDegradationReasons = resolveMetadataDegradationReasons(
    args.hydrationPreview,
    metadata,
    legacyBaselineObjectIds.length
  );
  const report: LocalDataMigrationValidationReport = {
    id: `${args.pointer.domain}:${args.pointer.commitId}:validation`,
    domain: args.pointer.domain,
    commitId: args.pointer.commitId,
    version: args.pointer.version,
    validatedAt: args.validatedAt,
    stagingHydrated: true,
    legacyBaselineCount: legacyBaselineObjectIds.length,
    legacyBaselineObjectIds,
    activeBaselineObjectIds: activeObjectIds.filter((id) => legacyBaselineObjectIds.includes(id)),
    activeObjectCount: activeObjectIds.length,
    activeObjectIds,
    quarantinedObjectCount: quarantinedObjectIds.length,
    quarantinedObjectIds,
    duplicateObjectIdCount: countDuplicateIds(args.censusDomainReport.activeObjectIds),
    missingActiveCollaboratorIdCount: missingActiveCollaboratorIds.length,
    missingActiveCollaboratorIds,
    activeIncompleteRowCount: args.hydrationPreview.nonCompleteRowCount,
    activeTimedOutRowCount: 0,
    recoveredMetadata: metadata,
    ...(Object.keys(metadataDegradationReasons).length > 0 ? { metadataDegradationReasons } : {})
  };

  assertValidMigrationPromotionReport(args.pointer, report);
  return report;
}

function collectQuarantineIssueIds(report: LocalDataCensusDomainReport) {
  return new Set([
    ...report.missingBodyObjectIds,
    ...report.missingAssetMetaRefIds,
    ...report.missingAssetBinaryRefIds
  ]);
}

export function buildLocalDataStoreHydrationValidationReports(args: {
  kv: LocalDataStoreHydrationPreviewEntry[];
  censusDomains: LocalDataCensusDomainReport[];
  domains?: LocalDataDomain[];
  validatedAt: number;
}): LocalDataStoreHydrationValidationReports {
  const domains = STORE_VALIDATION_DOMAINS.filter((domain) => !args.domains || args.domains.includes(domain));
  const hydrationPreviewReport = previewLocalDataStoreHydration(args.kv, domains);
  const validationReports: LocalDataStoreHydrationValidationReports['validationReports'] = {};
  const failures: LocalDataStoreHydrationValidationReports['failures'] = {};

  domains.forEach((domain) => {
    const pointer = readCommitPointer(args.kv, domain);
    const censusDomainReport = args.censusDomains.find((entry) => entry.domain === domain);
    const hydrationPreview = hydrationPreviewReport.previews.find((preview) => preview.domain === domain);
    if (!pointer || !censusDomainReport || !hydrationPreview || hydrationPreview.domain === 'chat') return;

    try {
      validationReports[domain] = buildLocalDataStoreHydrationValidationReport({
        pointer,
        censusDomainReport,
        hydrationPreview,
        validatedAt: args.validatedAt
      });
    } catch (error) {
      failures[domain] = error instanceof Error ? error.message : String(error);
    }
  });

  return { validationReports, failures };
}

function readCommitPointer(entries: LocalDataStoreHydrationPreviewEntry[], domain: LocalDataDomain) {
  const value = entries.find((entry) => entry.key === getLocalDataCommitPointerKey(domain))?.value;
  if (!isPlainRecord(value)) return null;
  return value.domain === domain
    && typeof value.version === 'number'
    && typeof value.committedAt === 'number'
    && typeof value.commitId === 'string'
    && value.commitId.trim().length > 0
    ? value as CommitPointerRow
    : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isPreviewValidationReady(preview: Exclude<LocalDataStoreHydrationPreview, { domain: 'chat' }>) {
  if (preview.domain === 'asset' || preview.domain === 'document') return preview.status === 'ledger-only';
  return preview.status === 'hydrated';
}

function resolveRecoveredMetadata(
  preview: Exclude<LocalDataStoreHydrationPreview, { domain: 'chat' }>,
  activeObjectIds: string[]
): LocalDataMigrationValidationReport['recoveredMetadata'] {
  if (preview.domain === 'collection') {
    return {
      activeProjectId: resolveCollectionActiveProjectId(preview, activeObjectIds)
    };
  }
  if (preview.domain === 'persona') {
    return {
      activeCollaboratorId: resolvePersonaActiveCollaboratorId(preview, activeObjectIds)
    };
  }
  return {};
}

function resolveCollectionActiveProjectId(preview: CollectionHydrationPreview, activeObjectIds: string[]) {
  const activeProjectId = preview.activeProjectId;
  if (!activeProjectId) return null;
  return activeObjectIds.includes(`project:${activeProjectId}`) ? activeProjectId : null;
}

function resolvePersonaActiveCollaboratorId(preview: PersonaHydrationPreview, activeObjectIds: string[]) {
  const activeCollaboratorId = preview.activeCollaboratorId;
  if (!activeCollaboratorId) return null;
  return activeObjectIds.includes(activeCollaboratorId) ? activeCollaboratorId : null;
}

function resolveMetadataDegradationReasons(
  preview: Exclude<LocalDataStoreHydrationPreview, { domain: 'chat' }>,
  metadata: LocalDataMigrationValidationReport['recoveredMetadata'],
  legacyBaselineCount: number
): NonNullable<LocalDataMigrationValidationReport['metadataDegradationReasons']> {
  if (legacyBaselineCount === 0) return {};
  if (preview.domain === 'collection' && metadata.activeProjectId === null) {
    return { activeProjectId: 'collection-active-project-not-present-in-active-baseline' };
  }
  if (preview.domain === 'persona' && metadata.activeCollaboratorId === null) {
    return { activeCollaboratorId: 'persona-active-collaborator-not-present-in-active-baseline' };
  }
  return {};
}

function uniqueSortedIds(ids: Iterable<string>) {
  return Array.from(new Set(Array.from(ids).filter((id) => id.trim().length > 0))).sort();
}

function countDuplicateIds(ids: Iterable<string>) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (!id.trim()) continue;
    if (seen.has(id)) {
      duplicates.add(id);
      continue;
    }
    seen.add(id);
  }
  return duplicates.size;
}
