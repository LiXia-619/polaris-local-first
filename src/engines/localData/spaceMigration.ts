import { buildSpaceLocalDataUnitOfWork, type SpaceLocalDataState } from './spaceRows';
import type { LocalDataCensusReport } from './localDataCensusReportTypes';
import type {
  LocalDataCommitMeta,
  LocalDataUnitOfWork
} from './types';

export type SpaceMigrationPlan = {
  unitOfWork: LocalDataUnitOfWork;
  sourceObjectCount: number;
  projectedObjectCount: number;
  expectedRepositoryRowCount: number;
};

export type SpaceMigrationCensusResult = {
  ok: boolean;
  sourceObjectCount: number;
  projectedObjectCount: number;
  expectedRepositoryRowCount: number;
  actualRepositoryRowCount: number;
  blockers: string[];
  warnings: string[];
};

export function buildSpaceMigrationPlan(args: {
  id?: string;
  state: SpaceLocalDataState;
  version: number;
  updatedAt: number;
}): SpaceMigrationPlan {
  const unitOfWork = buildSpaceLocalDataUnitOfWork(args);
  const sourceObjectCount = countSpaceObjects(args.state);

  return {
    unitOfWork,
    sourceObjectCount,
    projectedObjectCount: sourceObjectCount,
    expectedRepositoryRowCount: unitOfWork.mutations.length
  };
}

export function buildSpaceMigrationCensusResult(args: {
  plan: SpaceMigrationPlan;
  commitMeta: LocalDataCommitMeta;
  censusReport: LocalDataCensusReport;
}): SpaceMigrationCensusResult {
  const space = args.censusReport.domains.find((domain) => domain.domain === 'space');
  const actualRepositoryRowCount = space?.repositoryRowKeys.length ?? 0;
  const blockers = args.censusReport.blockers.filter((blocker) => blocker.startsWith('space:'));
  const warnings = args.censusReport.warnings.filter((warning) => warning.startsWith('space:'));

  return {
    ok: actualRepositoryRowCount === args.plan.expectedRepositoryRowCount && blockers.length === 0,
    sourceObjectCount: args.plan.sourceObjectCount,
    projectedObjectCount: args.plan.projectedObjectCount,
    expectedRepositoryRowCount: args.plan.expectedRepositoryRowCount,
    actualRepositoryRowCount,
    blockers,
    warnings
  };
}

function countSpaceObjects(state: SpaceLocalDataState) {
  // 3 singletons (frontstage / theme / customization) + N collaborator themes + N skins.
  return 3 + Object.keys(state.collaboratorThemes).length + state.theme.savedSkins.length;
}
