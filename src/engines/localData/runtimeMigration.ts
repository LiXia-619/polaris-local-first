import { buildRuntimeLocalDataUnitOfWork, type RuntimeLocalDataState } from './runtimeRows';
import type { LocalDataCensusReport } from './localDataCensusReportTypes';
import type {
  LocalDataCommitMeta,
  LocalDataUnitOfWork
} from './types';

export type RuntimeMigrationPlan = {
  unitOfWork: LocalDataUnitOfWork;
  sourceObjectCount: number;
  projectedObjectCount: number;
  expectedRepositoryRowCount: number;
};

export type RuntimeMigrationCensusResult = {
  ok: boolean;
  sourceObjectCount: number;
  projectedObjectCount: number;
  expectedRepositoryRowCount: number;
  actualRepositoryRowCount: number;
  blockers: string[];
  warnings: string[];
};

export function buildRuntimeMigrationPlan(args: {
  id?: string;
  state: RuntimeLocalDataState;
  version: number;
  updatedAt: number;
}): RuntimeMigrationPlan {
  const unitOfWork = buildRuntimeLocalDataUnitOfWork(args);
  const sourceObjectCount = countRuntimeObjects(args.state);

  return {
    unitOfWork,
    sourceObjectCount,
    projectedObjectCount: sourceObjectCount,
    expectedRepositoryRowCount: unitOfWork.mutations.length
  };
}

export function buildRuntimeMigrationCensusResult(args: {
  plan: RuntimeMigrationPlan;
  commitMeta: LocalDataCommitMeta;
  censusReport: LocalDataCensusReport;
}): RuntimeMigrationCensusResult {
  const runtime = args.censusReport.domains.find((domain) => domain.domain === 'runtime');
  const actualRepositoryRowCount = runtime?.repositoryRowKeys.length ?? 0;
  const blockers = args.censusReport.blockers.filter((blocker) => blocker.startsWith('runtime:'));
  const warnings = args.censusReport.warnings.filter((warning) => warning.startsWith('runtime:'));

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

function countRuntimeObjects(state: RuntimeLocalDataState) {
  return 1
    + state.providers.length
    + state.mcpServers.length
    + state.companionConnections.length
    + state.triggerRules.length;
}
