import {
  type PersistedDbEntry,
  type PersistenceStorageDiagnostic
} from './persistence';
import {
  listActiveAssetBinaryKeys,
  listActiveAssetMetaEntries,
  listActiveAssetPreviewKeys
} from './assetStore';
import {
  buildLocalDataCensusSnapshot,
  type LocalDataCensusSnapshot
} from '../engines/localData/localDataCensus';
import {
  type LocalDataCensusReport
} from '../engines/localData/localDataCensusReport';
import {
  buildLocalDataCensusReport as buildLocalDataCensusReportFromSource
} from '../engines/localData/localDataCensusReport';
import {
  buildLocalDataPromotionReadinessReport,
  type LocalDataPromotionReadinessReport
} from '../engines/localData/promotionReadiness';
import { buildLocalDataStoreHydrationValidationReports } from '../engines/localData/storeHydrationValidation';
import {
  buildLocalAssetStorageHealth,
  type LocalAssetStorageHealth
} from './localDataHealth/assetHealth';
import {
  buildLocalDataDomainSources,
  type LocalDataDomainSourceHealth
} from './localDataHealth/domainSources';
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  classifyKvKey,
  classifyLocalStorageKey,
  estimateLocalDataBytes,
  textBytes,
  type LocalDataHealthBucket,
  type LocalDataHealthBucketId
} from './localDataHealth/buckets';
import {
  buildLocalChatPersistenceHealth,
  type LocalChatPersistenceHealth
} from './localDataHealth/chatConsistency';
import {
  buildPersonaMemoryDocHealth,
  buildWorkspaceReferenceDocHealth,
  type LocalPersonaMemoryDocHealth,
  type LocalWorkspaceReferenceDocHealth
} from './localDataHealth/docBodyConsistency';
import {
  buildCollectionSourceHealth,
  type LocalCollectionSourceHealth
} from './localDataHealth/collectionConsistency';
import {
  buildCollaboratorOrphanDiagnostics,
  type LocalDataCollaboratorOrphanDiagnostic
} from './localDataHealth/collaboratorOrphans';
import { isPlainRecord } from './localDataHealth/recordGuards';
import {
  readLocalDataHealthSource,
  readLocalStorageEntries,
  type LocalDataHealthReadMode,
  type LocalDataHealthSource,
  type LocalStorageEntry
} from './localDataHealth/source';
import { readPersistedLocalDataMigrationValidationReportsFromEntries } from './localDataMigrationValidationEvidence';
import {
  LOCAL_DATA_LIVE_PROMOTION_RESULT_KEY,
  type LocalDataLivePromotionCommitSummary,
  type LocalDataLivePromotionReadinessSummary,
  type LocalDataLivePromotionSkippedDomainSummary
} from '../engines/localData/livePromotionSummary';
import type { LocalDataDomain } from '../engines/localData/types';

export type {
  LocalDataHealthBucketId,
  LocalDataHealthBucket
} from './localDataHealth/buckets';
export { estimateLocalDataBytes } from './localDataHealth/buckets';

export type { LocalChatPersistenceHealth } from './localDataHealth/chatConsistency';

export type {
  LocalPersonaMemoryDocHealth,
  LocalWorkspaceReferenceDocHealth
} from './localDataHealth/docBodyConsistency';

export type { LocalCollectionSourceHealth } from './localDataHealth/collectionConsistency';

export type { LocalAssetStorageHealth } from './localDataHealth/assetHealth';

export type {
  LocalDataDomainSourceStatus,
  LocalDataDomainSourceHealth
} from './localDataHealth/domainSources';

export type { LocalDataCollaboratorOrphanDiagnostic } from './localDataHealth/collaboratorOrphans';

export { readLocalDataPromotionReadinessKvEntries } from './localDataHealth/source';

export type LocalDataHealthSnapshot = {
  generatedAt: number;
  totalBytes: number;
  buckets: LocalDataHealthBucket[];
  largestBucketId: LocalDataHealthBucketId | null;
  storage: PersistenceStorageDiagnostic;
  chatPersistence: LocalChatPersistenceHealth;
  collectionSources: LocalCollectionSourceHealth;
  personaMemoryDocs: LocalPersonaMemoryDocHealth;
  workspaceReferenceDocs: LocalWorkspaceReferenceDocHealth;
  assetStorage: LocalAssetStorageHealth;
  census: LocalDataCensusSnapshot;
  censusReport: LocalDataCensusReport;
  promotionReadiness: LocalDataPromotionReadinessReport;
  livePromotion: LocalDataLivePromotionHealth | null;
  domainSources: LocalDataDomainSourceHealth[];
  collaboratorOrphans: LocalDataCollaboratorOrphanDiagnostic[];
};

export type LocalDataLivePromotionHealth =
  | {
    ok: true;
    startedAt: number;
    completedAt: number;
    activeDataSource: 'repository';
    activeDomains: LocalDataDomain[];
    activeCommits: LocalDataLivePromotionCommitSummary[];
    skippedDomains: LocalDataLivePromotionSkippedDomainSummary[];
    stagingReadiness: LocalDataLivePromotionReadinessSummary;
    promotionReadiness: LocalDataLivePromotionReadinessSummary;
  }
  | {
    ok: false;
    startedAt: number;
    completedAt: number;
    error: string;
    stagingReadiness: LocalDataLivePromotionReadinessSummary | null;
  };

function isLocalDataDomain(value: unknown): value is LocalDataDomain {
  return value === 'asset'
    || value === 'chat'
    || value === 'collection'
    || value === 'document'
    || value === 'persona'
    || value === 'runtime'
    || value === 'space';
}

function parseLivePromotionReadinessSummary(value: unknown): LocalDataLivePromotionReadinessSummary | null {
  if (!isPlainRecord(value) || !Array.isArray(value.domains)) return null;
  return {
    canHydrate: value.canHydrate === true,
    canPromote: value.canPromote === true,
    blockerCount: typeof value.blockerCount === 'number' ? value.blockerCount : 0,
    warningCount: typeof value.warningCount === 'number' ? value.warningCount : 0,
    domains: value.domains.flatMap((domain): LocalDataLivePromotionReadinessSummary['domains'] => {
      if (!isPlainRecord(domain) || !isLocalDataDomain(domain.domain)) return [];
      return [{
        domain: domain.domain,
        promotionReady: domain.promotionReady === true,
        status: typeof domain.status === 'string' ? domain.status : 'unknown',
        reasonCount: typeof domain.reasonCount === 'number' ? domain.reasonCount : 0,
        rowCount: typeof domain.rowCount === 'number' ? domain.rowCount : 0,
        completeRowCount: typeof domain.completeRowCount === 'number' ? domain.completeRowCount : 0,
        nonCompleteRowCount: typeof domain.nonCompleteRowCount === 'number' ? domain.nonCompleteRowCount : 0,
        remediationCount: typeof domain.remediationCount === 'number' ? domain.remediationCount : 0
      }];
    })
  };
}

function parseLivePromotionCommitSummary(value: unknown): LocalDataLivePromotionCommitSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): LocalDataLivePromotionCommitSummary[] => {
    if (!isPlainRecord(entry) || !isLocalDataDomain(entry.domain)) return [];
    if (
      typeof entry.version !== 'number'
      || typeof entry.committedAt !== 'number'
      || typeof entry.commitId !== 'string'
    ) return [];
    return [{
      domain: entry.domain,
      version: entry.version,
      committedAt: entry.committedAt,
      commitId: entry.commitId
    }];
  });
}

function parseLivePromotionSkippedDomainSummary(value: unknown): LocalDataLivePromotionSkippedDomainSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): LocalDataLivePromotionSkippedDomainSummary[] => {
    if (!isPlainRecord(entry) || !isLocalDataDomain(entry.domain)) return [];
    return [{
      domain: entry.domain,
      status: typeof entry.status === 'string' ? entry.status : 'unknown',
      reasons: Array.isArray(entry.reasons)
        ? entry.reasons.filter((reason): reason is string => typeof reason === 'string')
        : []
    }];
  });
}

function parseLocalDataLivePromotionHealth(localStorage: LocalStorageEntry[]): LocalDataLivePromotionHealth | null {
  const rawValue = localStorage.find((entry) => entry.key === LOCAL_DATA_LIVE_PROMOTION_RESULT_KEY)?.value;
  if (!rawValue) return null;

  try {
    const value = JSON.parse(rawValue) as unknown;
    if (!isPlainRecord(value)) return null;
    const startedAt = typeof value.startedAt === 'number' ? value.startedAt : 0;
    const completedAt = typeof value.completedAt === 'number' ? value.completedAt : 0;
    const stagingReadiness = isPlainRecord(value.staging)
      ? parseLivePromotionReadinessSummary(value.staging.readiness)
      : null;
    if (value.ok === true) {
      const promotionReadiness = parseLivePromotionReadinessSummary(value.readiness);
      if (!promotionReadiness) return null;
      return {
        ok: true,
        startedAt,
        completedAt,
        activeDataSource: 'repository',
        activeDomains: Array.isArray(value.activeDomains)
          ? value.activeDomains.filter(isLocalDataDomain)
          : [],
        activeCommits: parseLivePromotionCommitSummary(value.activeCommits),
        skippedDomains: parseLivePromotionSkippedDomainSummary(value.skippedDomains),
        stagingReadiness: stagingReadiness ?? promotionReadiness,
        promotionReadiness
      };
    }
    return {
      ok: false,
      startedAt,
      completedAt,
      error: typeof value.error === 'string' ? value.error : 'unknown-error',
      stagingReadiness
    };
  } catch {
    return null;
  }
}

export function buildLocalDataHealthSnapshot(source: LocalDataHealthSource): LocalDataHealthSnapshot {
  const bucketValues = new Map<LocalDataHealthBucketId, { bytes: number; entryCount: number }>(
    BUCKET_ORDER.map((id) => [id, { bytes: 0, entryCount: 0 }])
  );
  const add = (id: LocalDataHealthBucketId, bytes: number, entryCount = 1) => {
    const current = bucketValues.get(id) ?? { bytes: 0, entryCount: 0 };
    bucketValues.set(id, {
      bytes: current.bytes + Math.max(0, bytes),
      entryCount: current.entryCount + Math.max(0, entryCount)
    });
  };

  if (source.kvSizes) {
    source.kvSizes.forEach((entry) => {
      add(classifyKvKey(entry.key), entry.size);
    });
  } else {
    source.kv.forEach((entry) => {
      add(classifyKvKey(entry.key), estimateLocalDataBytes(entry.value));
    });
  }
  source.assetMeta.forEach((entry) => {
    add('assets', estimateLocalDataBytes(entry.value));
  });
  if (source.assetBinarySizes) {
    source.assetBinarySizes.forEach((entry) => {
      add('assets', entry.size, 0);
    });
  } else if (source.assetBinary) {
    source.assetBinary.forEach((entry) => {
      add('assets', estimateLocalDataBytes(entry.value), 0);
    });
  } else {
    source.assetMeta.forEach((entry) => {
      add('assets', entry.value.size, 0);
    });
  }
  if (source.assetPreviewSizes) {
    source.assetPreviewSizes.forEach((entry) => {
      add('assets', entry.size, 0);
    });
  } else {
    source.assetPreview?.forEach((entry) => {
      add('assets', estimateLocalDataBytes(entry.value), 0);
    });
  }
  source.localStorage.forEach((entry) => {
    add(classifyLocalStorageKey(entry.key), textBytes(entry.key) + textBytes(entry.value));
  });

  const buckets = BUCKET_ORDER.map((id) => ({
    id,
    label: BUCKET_LABELS[id],
    bytes: bucketValues.get(id)?.bytes ?? 0,
    entryCount: bucketValues.get(id)?.entryCount ?? 0
  }));
  const largest = buckets.reduce<LocalDataHealthBucket | null>(
    (current, bucket) => (!current || bucket.bytes > current.bytes ? bucket : current),
    null
  );

  const censusReport = buildLocalDataCensusReportFromHealthSource(source);
  const storeValidation = buildLocalDataStoreHydrationValidationReports({
    kv: source.kv,
    censusDomains: censusReport.domains,
    validatedAt: source.now ?? Date.now()
  });
  const persistedValidationReports = readPersistedLocalDataMigrationValidationReportsFromEntries(source.kv);
  const promotionReadiness = buildLocalDataPromotionReadinessReport({
    kv: source.kv,
    censusReport,
    validationReports: {
      ...persistedValidationReports,
      ...storeValidation.validationReports
    }
  });

  return {
    generatedAt: source.now ?? Date.now(),
    totalBytes: buckets.reduce((total, bucket) => total + bucket.bytes, 0),
    buckets,
    largestBucketId: largest && largest.bytes > 0 ? largest.id : null,
    storage: source.storage ?? {
      mode: 'indexeddb',
      label: 'IndexedDB',
      detail: '当前环境使用浏览器 IndexedDB。'
    },
    chatPersistence: buildLocalChatPersistenceHealth(source.kv),
    collectionSources: buildCollectionSourceHealth(source.kv),
    personaMemoryDocs: buildPersonaMemoryDocHealth(source.kv),
    workspaceReferenceDocs: buildWorkspaceReferenceDocHealth(source.kv),
    assetStorage: buildLocalAssetStorageHealth(source),
    census: buildLocalDataCensusSnapshot(source),
    censusReport,
    promotionReadiness,
    livePromotion: parseLocalDataLivePromotionHealth(source.localStorage),
    domainSources: buildLocalDataDomainSources({ censusReport, promotionReadiness }),
    collaboratorOrphans: buildCollaboratorOrphanDiagnostics(source, censusReport)
  };
}

export function buildLocalDataCensusReportFromHealthSource(
  source: Pick<LocalDataHealthSource, 'kv' | 'assetMeta' | 'assetBinary' | 'assetPreview' | 'assetBinaryKeys' | 'assetPreviewKeys' | 'localStorage'>
): LocalDataCensusReport {
  return buildLocalDataCensusReportFromSource(source);
}

export async function readLocalDataCensusReportForKv(kv: PersistedDbEntry[]): Promise<LocalDataCensusReport> {
  const [assetMeta, assetBinaryKeys, assetPreviewKeys] = await Promise.all([
    listActiveAssetMetaEntries(),
    listActiveAssetBinaryKeys(),
    listActiveAssetPreviewKeys()
  ]);

  return buildLocalDataCensusReportFromHealthSource({
    kv,
    assetMeta,
    assetBinaryKeys,
    assetPreviewKeys,
    localStorage: readLocalStorageEntries()
  });
}

export async function readLocalDataCensusReport(): Promise<LocalDataCensusReport> {
  return buildLocalDataCensusReportFromHealthSource(await readLocalDataHealthSource());
}

export async function readLocalDataHealthSnapshot(options: { mode?: LocalDataHealthReadMode } = {}): Promise<LocalDataHealthSnapshot> {
  return buildLocalDataHealthSnapshot(await readLocalDataHealthSource(options.mode ?? 'metadata'));
}
