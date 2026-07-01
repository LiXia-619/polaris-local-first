import { buildAssetLocalDataUnitOfWork, type AssetLocalDataState } from './assetRows';
import type { LocalDataCensusReport } from './localDataCensusReportTypes';
import type {
  LocalDataCommitMeta,
  LocalDataUnitOfWork
} from './types';

export type AssetMigrationPlan = {
  unitOfWork: LocalDataUnitOfWork;
  sourceObjectCount: number;
  activeObjectCount: number;
  orphanObjectCount: number;
  missingMetaCount: number;
  missingBinaryCount: number;
  previewOnlyCount: number;
  totalBinaryBytes: number;
  totalPreviewBytes: number;
  expectedRepositoryRowCount: number;
};

export type AssetMigrationCensusResult = {
  ok: boolean;
  sourceObjectCount: number;
  activeObjectCount: number;
  orphanObjectCount: number;
  missingMetaCount: number;
  missingBinaryCount: number;
  previewOnlyCount: number;
  totalBinaryBytes: number;
  totalPreviewBytes: number;
  expectedRepositoryRowCount: number;
  actualRepositoryRowCount: number;
  blockers: string[];
  warnings: string[];
};

export function buildAssetMigrationPlan(args: {
  id?: string;
  state: AssetLocalDataState;
  version: number;
  updatedAt: number;
}): AssetMigrationPlan {
  const sourceIds = collectAssetSourceIds(args.state);
  const metaIds = new Set(args.state.meta.map((entry) => entry.id));
  const binaryIds = new Set(args.state.binary.map((entry) => entry.id));
  const previewIds = new Set(args.state.preview.map((entry) => entry.id));
  const unitOfWork = buildAssetLocalDataUnitOfWork({
    id: args.id,
    state: args.state,
    version: args.version,
    updatedAt: args.updatedAt
  });

  return {
    unitOfWork,
    sourceObjectCount: sourceIds.size,
    activeObjectCount: Array.from(sourceIds).filter((id) => (
      metaIds.has(id)
      && binaryIds.has(id)
      && (args.state.ownersByAssetId.get(id)?.length ?? 0) > 0
    )).length,
    orphanObjectCount: Array.from(sourceIds).filter((id) => (
      metaIds.has(id)
      && binaryIds.has(id)
      && (args.state.ownersByAssetId.get(id)?.length ?? 0) === 0
    )).length,
    missingMetaCount: Array.from(sourceIds).filter((id) => !metaIds.has(id)).length,
    missingBinaryCount: Array.from(metaIds).filter((id) => !binaryIds.has(id)).length,
    previewOnlyCount: Array.from(previewIds).filter((id) => !metaIds.has(id) && !binaryIds.has(id)).length,
    totalBinaryBytes: args.state.binary.reduce((sum, entry) => sum + entry.bytes, 0),
    totalPreviewBytes: args.state.preview.reduce((sum, entry) => sum + entry.bytes, 0),
    expectedRepositoryRowCount: unitOfWork.mutations.length
  };
}

export function buildAssetMigrationCensusResult(args: {
  plan: AssetMigrationPlan;
  commitMeta: LocalDataCommitMeta;
  censusReport: LocalDataCensusReport;
}): AssetMigrationCensusResult {
  const asset = args.censusReport.domains.find((domain) => domain.domain === 'asset');
  const actualRepositoryRowCount = asset?.repositoryRowKeys.length ?? 0;
  const blockers = args.censusReport.blockers.filter((blocker) => blocker.startsWith('asset:'));
  const warnings = args.censusReport.warnings.filter((warning) => warning.startsWith('asset:'));

  return {
    ok: actualRepositoryRowCount === args.plan.expectedRepositoryRowCount && blockers.length === 0,
    sourceObjectCount: args.plan.sourceObjectCount,
    activeObjectCount: args.plan.activeObjectCount,
    orphanObjectCount: args.plan.orphanObjectCount,
    missingMetaCount: args.plan.missingMetaCount,
    missingBinaryCount: args.plan.missingBinaryCount,
    previewOnlyCount: args.plan.previewOnlyCount,
    totalBinaryBytes: args.plan.totalBinaryBytes,
    totalPreviewBytes: args.plan.totalPreviewBytes,
    expectedRepositoryRowCount: args.plan.expectedRepositoryRowCount,
    actualRepositoryRowCount,
    blockers,
    warnings
  };
}

function collectAssetSourceIds(state: AssetLocalDataState) {
  return new Set([
    ...state.meta.map((entry) => entry.id),
    ...state.binary.map((entry) => entry.id),
    ...state.preview.map((entry) => entry.id)
  ]);
}
