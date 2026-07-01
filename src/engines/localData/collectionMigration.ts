import { repairCollectionProjectTopology } from '../../stores/collectionStoreProjectTopology';
import { buildCollectionLocalDataUnitOfWork, type CollectionLocalDataState } from './collectionRows';
import type { LocalDataCensusReport } from './localDataCensusReportTypes';
import type {
  LocalDataCommitMeta,
  LocalDataUnitOfWork
} from './types';

export type CollectionMigrationPlan = {
  unitOfWork: LocalDataUnitOfWork;
  sourceObjectCount: number;
  projectedObjectCount: number;
  recoveredProjectCount: number;
  expectedRepositoryRowCount: number;
};

export type CollectionMigrationCensusResult = {
  ok: boolean;
  sourceObjectCount: number;
  projectedObjectCount: number;
  recoveredProjectCount: number;
  expectedRepositoryRowCount: number;
  actualRepositoryRowCount: number;
  blockers: string[];
  warnings: string[];
};

export function buildCollectionMigrationPlan(args: {
  id?: string;
  state: CollectionLocalDataState;
  activeProjectId: string | null;
  version: number;
  updatedAt: number;
}): CollectionMigrationPlan {
  const sourceObjectCount = countCollectionObjects(args.state);
  const repaired = repairCollectionProjectTopology(args.state);
  const projectedObjectCount = countCollectionObjects(repaired);
  const activeProjectId = resolveActiveProjectId(args.activeProjectId, repaired);
  const unitOfWork = buildCollectionLocalDataUnitOfWork({
    id: args.id,
    activeProjectId,
    state: repaired,
    version: args.version,
    updatedAt: args.updatedAt
  });

  return {
    unitOfWork,
    sourceObjectCount,
    projectedObjectCount,
    recoveredProjectCount: Math.max(0, projectedObjectCount - sourceObjectCount),
    expectedRepositoryRowCount: unitOfWork.mutations.length
  };
}

export function buildCollectionMigrationCensusResult(args: {
  plan: CollectionMigrationPlan;
  commitMeta: LocalDataCommitMeta;
  censusReport: LocalDataCensusReport;
}): CollectionMigrationCensusResult {
  const collection = args.censusReport.domains.find((domain) => domain.domain === 'collection');
  const actualRepositoryRowCount = collection?.repositoryRowKeys.length ?? 0;
  const blockers = args.censusReport.blockers.filter((blocker) => blocker.startsWith('collection:'));
  const warnings = args.censusReport.warnings.filter((warning) => warning.startsWith('collection:'));

  return {
    ok: actualRepositoryRowCount === args.plan.expectedRepositoryRowCount,
    sourceObjectCount: args.plan.sourceObjectCount,
    projectedObjectCount: args.plan.projectedObjectCount,
    recoveredProjectCount: args.plan.recoveredProjectCount,
    expectedRepositoryRowCount: args.plan.expectedRepositoryRowCount,
    actualRepositoryRowCount,
    blockers,
    warnings
  };
}

function countCollectionObjects(state: CollectionLocalDataState) {
  return state.cards.length
    + state.imageCards.length
    + state.roomProjects.length
    + state.projectFiles.length
    + state.workspaceReferenceDocs.length;
}

function resolveActiveProjectId(activeProjectId: string | null, state: CollectionLocalDataState) {
  if (activeProjectId && state.roomProjects.some((project) => project.id === activeProjectId)) return activeProjectId;
  return state.roomProjects[0]?.id ?? null;
}
