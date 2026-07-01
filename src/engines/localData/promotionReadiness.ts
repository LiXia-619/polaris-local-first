import type { PersistedDbEntry } from '../../infrastructure/persistence';
import {
  assertValidMigrationPromotionReport
} from './migrationValidation';
import type { LocalDataCensusReport } from './localDataCensusReportTypes';
import {
  previewLocalDataStoreHydration,
  type LocalDataHydrationPreviewStatus,
  type LocalDataStoreHydrationPreview
} from './storeHydrationPreview';
import {
  LOCAL_DATA_NAMESPACE,
  getLocalDataCommitPointerKey,
  type CommitPointerRow,
  type LocalDataDomain,
  type LocalDataMigrationValidationReport,
  type LocalDataStoredRow
} from './types';

export const LOCAL_DATA_PROMOTION_DOMAIN_ORDER: LocalDataDomain[] = [
  'chat',
  'collection',
  'persona',
  'runtime',
  'space',
  'asset',
  'document'
];

export type LocalDataPromotionDomainStatus =
  | 'not_committed'
  | 'blocked'
  | 'staged'
  | 'promotion_ready'
  | 'promotion_ready_with_source_issues';

export type LocalDataReadinessRemediationScope =
  | 'source'
  | 'staging'
  | 'hydration'
  | 'validation'
  | 'promotion';

export type LocalDataReadinessRemediation = {
  scope: LocalDataReadinessRemediationScope;
  code: string;
  message: string;
  nextAction: string;
};

export type LocalDataPromotionDomainReadiness = {
  domain: LocalDataDomain;
  status: LocalDataPromotionDomainStatus;
  stageReady: boolean;
  promotionReady: boolean;
  pointer: CommitPointerRow | null;
  rowCount: number;
  completeRowCount: number;
  nonCompleteRowCount: number;
  rowStateCounts: Record<LocalDataStoredRow['state'], number>;
  hydrationStatus: LocalDataHydrationPreviewStatus;
  hydrationObjectCount: number;
  hydrationBlockers: string[];
  blockers: string[];
  warnings: string[];
  reasons: string[];
  remediation: LocalDataReadinessRemediation[];
};

export type LocalDataPromotionReadinessReport = {
  canHydrate: boolean;
  canPromote: boolean;
  activeDataSource: LocalDataCensusReport['activeDataSource'];
  domains: LocalDataPromotionDomainReadiness[];
  blockers: string[];
  warnings: string[];
};

export type LocalDataPromotionReadinessSource = {
  kv: PersistedDbEntry[];
  censusReport: LocalDataCensusReport;
  validationReports?: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>>;
  domains?: LocalDataDomain[];
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isCommitPointerRow(value: unknown, domain: LocalDataDomain): value is CommitPointerRow {
  if (!isPlainRecord(value)) return false;
  return value.domain === domain
    && typeof value.version === 'number'
    && typeof value.committedAt === 'number'
    && typeof value.commitId === 'string'
    && value.commitId.trim().length > 0;
}

function isLocalDataStoredRow(value: unknown, domain: LocalDataDomain): value is LocalDataStoredRow {
  if (!isPlainRecord(value) || !isPlainRecord(value.ref)) return false;
  if (value.ref.domain !== domain) return false;
  return value.state === 'complete'
    || value.state === 'unloaded'
    || value.state === 'incomplete'
    || value.state === 'timedOut'
    || value.state === 'deleted';
}

function emptyRowStateCounts(): Record<LocalDataStoredRow['state'], number> {
  return {
    complete: 0,
    unloaded: 0,
    incomplete: 0,
    timedOut: 0,
    deleted: 0
  };
}

function rowEntriesForDomain(kv: PersistedDbEntry[], domain: LocalDataDomain) {
  const prefix = `${LOCAL_DATA_NAMESPACE}:row:${domain}:`;
  return kv.filter((entry) => entry.key.startsWith(prefix));
}

function readPointer(kv: PersistedDbEntry[], domain: LocalDataDomain) {
  const value = kv.find((entry) => entry.key === getLocalDataCommitPointerKey(domain))?.value;
  return isCommitPointerRow(value, domain) ? value : null;
}

function validationReadiness(args: {
  pointer: CommitPointerRow;
  report: LocalDataMigrationValidationReport | undefined;
}) {
  if (!args.report) {
    return {
      ready: false,
      reason: 'validation-missing'
    };
  }

  try {
    assertValidMigrationPromotionReport({
      domain: args.pointer.domain,
      version: args.pointer.version,
      committedAt: args.pointer.committedAt,
      commitId: args.pointer.commitId
    }, args.report);
    return { ready: true, reason: null };
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? `validation-failed:${error.message}` : `validation-failed:${String(error)}`
    };
  }
}

function isResolvedSourceCensusBlocker(args: {
  blocker: string;
  domain: LocalDataDomain;
  domainReport: LocalDataCensusReport['domains'][number] | undefined;
  hydrationReady: boolean;
  validationReport: LocalDataMigrationValidationReport | undefined;
  validationReady: boolean;
}) {
  if (!args.hydrationReady || !args.validationReady || !args.validationReport) return false;
  if (args.blocker === `${args.domain}:metadata-issue`) return true;

  const issueIds = sourceIssueIdsForBlocker(args.domainReport, args.blocker);
  if (isChatAttachmentAssetIssueBlocker(args.domainReport, args.blocker, issueIds)) return true;
  if (isDetachedBodyIssueBlocker(args.domainReport, args.blocker, issueIds)) return true;

  const quarantinedIds = new Set(args.validationReport.quarantinedObjectIds);
  return issueIds.length > 0 && issueIds.every((id) => quarantinedIds.has(id));
}

function isChatAttachmentAssetIssueBlocker(
  domainReport: LocalDataCensusReport['domains'][number] | undefined,
  blocker: string,
  issueIds: string[]
) {
  return domainReport?.domain === 'chat'
    && (
      blocker === 'chat:missing-asset-meta'
      || blocker === 'chat:missing-asset-binary'
    )
    && issueIds.length > 0;
}

function isDetachedBodyIssueBlocker(
  domainReport: LocalDataCensusReport['domains'][number] | undefined,
  blocker: string,
  issueIds: string[]
) {
  if (!domainReport || blocker !== `${domainReport.domain}:missing-body` || issueIds.length === 0) return false;
  const domainObjectIds = new Set([
    ...domainReport.baselineObjectIds,
    ...domainReport.activeObjectIds
  ]);
  return issueIds.every((id) => !domainObjectIds.has(id));
}

function sourceIssueIdsForBlocker(
  domainReport: LocalDataCensusReport['domains'][number] | undefined,
  blocker: string
) {
  if (!domainReport) return [];
  switch (blocker) {
    case `${domainReport.domain}:missing-body`:
      return domainReport.missingBodyObjectIds;
    case `${domainReport.domain}:missing-asset-meta`:
      return domainReport.missingAssetMetaRefIds;
    case `${domainReport.domain}:missing-asset-binary`:
      return domainReport.missingAssetBinaryRefIds;
    default:
      return [];
  }
}

function isHydrationStageReady(domain: LocalDataDomain, preview: LocalDataStoreHydrationPreview) {
  if (domain === 'chat') return preview.status === 'delegated';
  if (domain === 'asset' || domain === 'document') return preview.status === 'ledger-only';
  return preview.status === 'hydrated';
}

function remediationForReason(domain: LocalDataDomain, reason: string): LocalDataReadinessRemediation {
  if (reason === 'missing-pointer') {
    return {
      scope: 'staging',
      code: 'missing-pointer',
      message: 'No LocalData commit pointer exists for this domain, so repository rows cannot be trusted as a committed staging set.',
      nextAction: `Run the ${domain} migration staging bridge before checking promotion readiness again.`
    };
  }
  if (reason === 'missing-repository-rows') {
    return {
      scope: 'staging',
      code: 'missing-repository-rows',
      message: 'No LocalData repository rows were found for this domain.',
      nextAction: `Rebuild and commit the ${domain} LocalData unit of work from the legacy source.`
    };
  }
  if (reason === 'non-complete-rows') {
    return {
      scope: 'source',
      code: 'non-complete-rows',
      message: 'At least one staged row is unloaded, incomplete, timed out, or deleted, so it cannot enter the active projection.',
      nextAction: `Inspect the ${domain} row-state counts and repair the source reader or quarantine path before restaging.`
    };
  }
  if (reason === 'repository-row-count-mismatch') {
    return {
      scope: 'staging',
      code: 'repository-row-count-mismatch',
      message: 'The census row list and the repository row set disagree.',
      nextAction: `Re-run the ${domain} census after staging and verify the migration bridge writes the expected row set.`
    };
  }
  if (reason.startsWith('invalid-row:')) {
    return {
      scope: 'staging',
      code: 'invalid-row',
      message: 'A persisted LocalData row does not match the expected row envelope for its domain.',
      nextAction: `Discard this ${domain} staging set and restage through LocalDataRepository so row keys, refs, and states are validated.`
    };
  }
  if (reason.startsWith('census-blocker:')) {
    return {
      scope: 'source',
      code: 'census-blocker',
      message: 'The local data census found a source integrity blocker for this domain.',
      nextAction: `Fix the ${domain} census blocker at the source or preserve it as explicit quarantine evidence before restaging.`
    };
  }
  if (reason.startsWith('hydration-blocker:')) {
    return {
      scope: 'hydration',
      code: reason.slice('hydration-blocker:'.length),
      message: 'The staged rows cannot be reconstructed into this domain role without losing required structure.',
      nextAction: `Fix the ${domain} row adapter or migration source so hydration preview passes before any active source switch.`
    };
  }
  if (reason.startsWith('hydration-')) {
    return {
      scope: 'hydration',
      code: reason,
      message: 'The hydration preview did not reach the status required for this domain role.',
      nextAction: `Read the ${domain} hydration blockers and restage rows that match the domain hydration contract.`
    };
  }
  if (reason === 'validation-missing') {
    return {
      scope: 'validation',
      code: 'validation-missing',
      message: 'The staging set can hydrate, but no promotion validation report proves it preserves the legacy baseline.',
      nextAction: `Run the ${domain} validation/readback path and attach its report before promotion.`
    };
  }
  if (reason.startsWith('validation-failed:')) {
    return {
      scope: 'validation',
      code: 'validation-failed',
      message: 'The promotion validation report failed the repository promotion contract.',
      nextAction: `Fix the ${domain} validation failure, then rerun staging readback and validation.`
    };
  }
  return {
    scope: 'promotion',
    code: reason,
    message: 'This readiness reason blocks automatic promotion.',
    nextAction: `Review the ${domain} migration evidence and rerun readiness after the reason is resolved.`
  };
}

function buildRemediation(domain: LocalDataDomain, reasons: string[]) {
  const byKey = new Map<string, LocalDataReadinessRemediation>();
  reasons.forEach((reason) => {
    const remediation = remediationForReason(domain, reason);
    byKey.set(`${remediation.scope}:${remediation.code}`, remediation);
  });
  return Array.from(byKey.values());
}

function buildDomainReadiness(args: {
  domain: LocalDataDomain;
  kv: PersistedDbEntry[];
  censusReport: LocalDataCensusReport;
  hydrationPreview: LocalDataStoreHydrationPreview;
  validationReport?: LocalDataMigrationValidationReport;
}): LocalDataPromotionDomainReadiness {
  const domainReport = args.censusReport.domains.find((entry) => entry.domain === args.domain);
  const pointer = readPointer(args.kv, args.domain);
  const rowEntries = rowEntriesForDomain(args.kv, args.domain);
  const rowStateCounts = emptyRowStateCounts();
  const reasons: string[] = [];

  rowEntries.forEach((entry) => {
    if (!isLocalDataStoredRow(entry.value, args.domain)) {
      reasons.push(`invalid-row:${entry.key}`);
      return;
    }
    rowStateCounts[entry.value.state] += 1;
  });

  const blockers = args.censusReport.blockers.filter((blocker) => blocker.startsWith(`${args.domain}:`));
  const warnings = args.censusReport.warnings.filter((warning) => warning.startsWith(`${args.domain}:`));
  if (!pointer) reasons.push('missing-pointer');
  if (rowEntries.length === 0) reasons.push('missing-repository-rows');

  // For every pure-object-row domain an incomplete row means a torn/failed migration and blocks
  // promotion. Asset is different: a `preview-only` / `missing-meta` / `missing-binary` row is a
  // FAITHFUL record of an incomplete source asset (an orphan preview cache, a binary that is gone),
  // not a migration failure — the product getters already return null binary for it. So incomplete
  // asset rows do not block asset promotion; the recovery lifecycle (a later slice) layers on top.
  const incompleteRowsBlockPromotion = args.domain !== 'asset';
  const nonCompleteRowCount = rowEntries.length - rowStateCounts.complete;
  if (incompleteRowsBlockPromotion && nonCompleteRowCount > 0) reasons.push('non-complete-rows');
  if (domainReport && domainReport.repositoryRowKeys.length !== rowEntries.length) {
    reasons.push('repository-row-count-mismatch');
  }
  const hydrationReady = isHydrationStageReady(args.domain, args.hydrationPreview);
  if (pointer && rowEntries.length > 0 && !hydrationReady) {
    reasons.push(`hydration-${args.hydrationPreview.status}`);
    args.hydrationPreview.blockers.forEach((blocker) => reasons.push(`hydration-blocker:${blocker}`));
  }
  const validation = pointer
    ? validationReadiness({ pointer, report: args.validationReport })
    : { ready: false, reason: null };
  const blockingCensusBlockers = blockers.filter((blocker) => !isResolvedSourceCensusBlocker({
    blocker,
    domain: args.domain,
    domainReport,
    hydrationReady,
    validationReport: args.validationReport,
    validationReady: validation.ready
  }));
  blockingCensusBlockers.forEach((blocker) => reasons.push(`census-blocker:${blocker}`));

  const stageReady = Boolean(pointer)
    && rowEntries.length > 0
    && blockingCensusBlockers.length === 0
    && (!incompleteRowsBlockPromotion || nonCompleteRowCount === 0)
    && hydrationReady
    && !reasons.some((reason) => reason.startsWith('invalid-row') || reason === 'repository-row-count-mismatch');
  if (stageReady && validation.reason) reasons.push(validation.reason);

  const promotionReady = stageReady && validation.ready;
  const status: LocalDataPromotionDomainStatus = promotionReady
    ? blockers.length > 0
      ? 'promotion_ready_with_source_issues'
      : 'promotion_ready'
    : stageReady
      ? 'staged'
      : pointer || rowEntries.length > 0
        ? 'blocked'
        : 'not_committed';

  return {
    domain: args.domain,
    status,
    stageReady,
    promotionReady,
    pointer,
    rowCount: rowEntries.length,
    completeRowCount: rowStateCounts.complete,
    nonCompleteRowCount,
    rowStateCounts,
    hydrationStatus: args.hydrationPreview.status,
    hydrationObjectCount: args.hydrationPreview.objectCount,
    hydrationBlockers: args.hydrationPreview.blockers,
    blockers,
    warnings,
    reasons,
    remediation: buildRemediation(args.domain, reasons)
  };
}

export function buildLocalDataPromotionReadinessReport(
  source: LocalDataPromotionReadinessSource
): LocalDataPromotionReadinessReport {
  const selectedDomains = source.domains ?? LOCAL_DATA_PROMOTION_DOMAIN_ORDER;
  const hydrationPreviewReport = previewLocalDataStoreHydration(source.kv, selectedDomains);
  const domains = selectedDomains.map((domain) => {
    const hydrationPreview = hydrationPreviewReport.previews.find((preview) => preview.domain === domain);
    if (!hydrationPreview) {
      throw new Error(`Missing LocalData hydration preview for ${domain}.`);
    }
    return buildDomainReadiness({
      domain,
      kv: source.kv,
      censusReport: source.censusReport,
      hydrationPreview,
      validationReport: source.validationReports?.[domain]
    });
  });

  return {
    canHydrate: domains.every((domain) => domain.stageReady),
    canPromote: domains.every((domain) => domain.promotionReady),
    activeDataSource: source.censusReport.activeDataSource,
    domains,
    blockers: domains.flatMap((domain) => domain.reasons.map((reason) => `${domain.domain}:${reason}`)),
    warnings: domains.flatMap((domain) => domain.warnings)
  };
}
