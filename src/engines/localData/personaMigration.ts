import { buildPersonaLocalDataUnitOfWork, type PersonaLocalDataState } from './personaRows';
import type { LocalDataCensusReport } from './localDataCensusReportTypes';
import type {
  LocalDataCommitMeta,
  LocalDataUnitOfWork
} from './types';

export type PersonaMigrationPlan = {
  unitOfWork: LocalDataUnitOfWork;
  sourceObjectCount: number;
  projectedObjectCount: number;
  expectedRepositoryRowCount: number;
};

export type PersonaMigrationCensusResult = {
  ok: boolean;
  sourceObjectCount: number;
  projectedObjectCount: number;
  expectedRepositoryRowCount: number;
  actualRepositoryRowCount: number;
  blockers: string[];
  warnings: string[];
};

export function buildPersonaMigrationPlan(args: {
  id?: string;
  state: PersonaLocalDataState;
  version: number;
  updatedAt: number;
}): PersonaMigrationPlan {
  const unitOfWork = buildPersonaLocalDataUnitOfWork(args);

  return {
    unitOfWork,
    sourceObjectCount: args.state.personas.length,
    projectedObjectCount: args.state.personas.length,
    expectedRepositoryRowCount: unitOfWork.mutations.length
  };
}

export function buildPersonaMigrationCensusResult(args: {
  plan: PersonaMigrationPlan;
  commitMeta: LocalDataCommitMeta;
  censusReport: LocalDataCensusReport;
}): PersonaMigrationCensusResult {
  const persona = args.censusReport.domains.find((domain) => domain.domain === 'persona');
  const actualRepositoryRowCount = persona?.repositoryRowKeys.length ?? 0;
  const blockers = args.censusReport.blockers.filter((blocker) => blocker.startsWith('persona:'));
  const warnings = args.censusReport.warnings.filter((warning) => (
    warning.startsWith('persona:') && warning !== 'persona:orphan-body'
  ));

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
