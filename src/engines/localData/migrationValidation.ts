import {
  type LocalDataCommitMeta,
  type LocalDataDomain,
  type LocalDataDomainMetadataKey,
  type LocalDataMigrationValidationReport
} from './types';

export class LocalDataMigrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalDataMigrationValidationError';
  }
}

export const REQUIRED_PROMOTION_METADATA: Partial<Record<LocalDataDomain, LocalDataDomainMetadataKey[]>> = {
  chat: ['activeConversationId'],
  collection: ['activeProjectId'],
  persona: ['activeCollaboratorId']
};

export function assertValidMigrationPromotionReport(
  meta: LocalDataCommitMeta,
  report: LocalDataMigrationValidationReport
) {
  if (
    report.domain !== meta.domain
    || report.commitId !== meta.commitId
    || report.version !== meta.version
  ) {
    throwPromotionValidationError(meta, 'Local data migration validation report does not match promoted commit.');
  }
  if (report.stagingHydrated !== true) {
    throwPromotionValidationError(meta, 'Local data migration validation did not hydrate staging.');
  }
  if (
    !Number.isFinite(report.legacyBaselineCount)
    || !Number.isFinite(report.activeObjectCount)
    || !Number.isFinite(report.quarantinedObjectCount)
    || !Number.isFinite(report.duplicateObjectIdCount)
    || !Number.isFinite(report.missingActiveCollaboratorIdCount)
    || report.legacyBaselineCount < 0
    || report.activeObjectCount < 0
    || report.quarantinedObjectCount < 0
    || report.duplicateObjectIdCount < 0
    || report.missingActiveCollaboratorIdCount < 0
  ) {
    throwPromotionValidationError(meta, 'Local data migration validation has invalid object counts.');
  }
  if (
    !isUniqueObjectIdList(report.legacyBaselineObjectIds)
    || report.legacyBaselineObjectIds.length !== report.legacyBaselineCount
  ) {
    throwPromotionValidationError(meta, 'Local data migration validation has invalid legacy baseline.');
  }
  if (
    !isUniqueObjectIdList(report.activeBaselineObjectIds)
    || report.activeBaselineObjectIds.length > report.legacyBaselineCount
    || !idsAreSubset(report.activeBaselineObjectIds, report.legacyBaselineObjectIds)
  ) {
    throwPromotionValidationError(meta, 'Local data migration validation has invalid active baseline.');
  }
  if (
    !isUniqueObjectIdList(report.activeObjectIds)
    || report.activeObjectIds.length !== report.activeObjectCount
  ) {
    throwPromotionValidationError(meta, 'Local data migration validation has invalid active object ids.');
  }
  if (
    !isUniqueObjectIdList(report.quarantinedObjectIds)
    || report.quarantinedObjectIds.length !== report.quarantinedObjectCount
  ) {
    throwPromotionValidationError(meta, 'Local data migration validation has invalid quarantined object ids.');
  }
  if (idsOverlap(report.activeObjectIds, report.quarantinedObjectIds)) {
    throwPromotionValidationError(meta, 'Local data migration validation contains duplicate object ids.');
  }
  if (report.duplicateObjectIdCount !== 0) {
    throwPromotionValidationError(meta, 'Local data migration validation contains duplicate object ids.');
  }
  if (
    !isUniqueObjectIdList(report.missingActiveCollaboratorIds)
    || report.missingActiveCollaboratorIds.length !== report.missingActiveCollaboratorIdCount
  ) {
    throwPromotionValidationError(meta, 'Local data migration validation has invalid collaborator closure evidence.');
  }
  if (report.activeObjectCount + report.quarantinedObjectCount < report.legacyBaselineCount) {
    throwPromotionValidationError(meta, 'Local data migration validation shrank the legacy baseline.');
  }
  const activeObjectIds = new Set(report.activeObjectIds);
  if (report.activeBaselineObjectIds.some((id) => !activeObjectIds.has(id))) {
    throwPromotionValidationError(meta, 'Local data migration validation shrank the active projection.');
  }
  if (!idsAreSubset(report.legacyBaselineObjectIds, [
    ...report.activeObjectIds,
    ...report.quarantinedObjectIds
  ])) {
    throwPromotionValidationError(meta, 'Local data migration validation lost legacy object ids.');
  }
  if (
    !Number.isFinite(report.activeIncompleteRowCount)
    || !Number.isFinite(report.activeTimedOutRowCount)
    || report.activeIncompleteRowCount < 0
    || report.activeTimedOutRowCount < 0
  ) {
    throwPromotionValidationError(meta, 'Local data migration validation has invalid row-state counts.');
  }
  if (report.activeIncompleteRowCount !== 0 || report.activeTimedOutRowCount !== 0) {
    throwPromotionValidationError(meta, 'Local data migration validation contains non-complete active rows.');
  }

  for (const metadataKey of REQUIRED_PROMOTION_METADATA[meta.domain] ?? []) {
    const metadataValue = report.recoveredMetadata[metadataKey];
    if (!Object.prototype.hasOwnProperty.call(report.recoveredMetadata, metadataKey)) {
      throwPromotionValidationError(meta, `Local data migration validation did not recover ${metadataKey}.`);
    }
    if (metadataValue !== null && typeof metadataValue !== 'string') {
      throwPromotionValidationError(meta, `Local data migration validation recovered invalid ${metadataKey}.`);
    }
    if (
      metadataValue === null
      && report.legacyBaselineCount > 0
      && !report.metadataDegradationReasons?.[metadataKey]?.trim()
    ) {
      throwPromotionValidationError(meta, `Local data migration validation degraded ${metadataKey} without a reason.`);
    }
  }
}

function throwPromotionValidationError(meta: LocalDataCommitMeta, message: string): never {
  throw new LocalDataMigrationValidationError(`${message} ${meta.domain}/${meta.commitId}`);
}

function isUniqueObjectIdList(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || seen.has(item)) return false;
    seen.add(item);
  }
  return true;
}

function idsAreSubset(needles: readonly string[], haystack: readonly string[]) {
  const haystackIds = new Set(haystack);
  return needles.every((id) => haystackIds.has(id));
}

function idsOverlap(left: readonly string[], right: readonly string[]) {
  const leftIds = new Set(left);
  return right.some((id) => leftIds.has(id));
}
