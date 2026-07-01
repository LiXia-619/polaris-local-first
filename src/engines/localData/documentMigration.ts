import {
  buildDocumentLocalDataUnitOfWork,
  documentObjectHasIncompleteChunks,
  documentObjectHasMissingBody,
  type DocumentLocalDataState
} from './documentRows';
import type { LocalDataCensusReport } from './localDataCensusReportTypes';
import type {
  LocalDataCommitMeta,
  LocalDataUnitOfWork
} from './types';

export type DocumentMigrationPlan = {
  unitOfWork: LocalDataUnitOfWork;
  sourceObjectCount: number;
  projectedObjectCount: number;
  missingBodyCount: number;
  incompleteChunkCount: number;
  orphanBodyCount: number;
  expectedRepositoryRowCount: number;
};

export type DocumentMigrationCensusResult = {
  ok: boolean;
  sourceObjectCount: number;
  projectedObjectCount: number;
  missingBodyCount: number;
  incompleteChunkCount: number;
  orphanBodyCount: number;
  expectedRepositoryRowCount: number;
  actualRepositoryRowCount: number;
  blockers: string[];
  warnings: string[];
};

export function buildDocumentMigrationPlan(args: {
  id?: string;
  state: DocumentLocalDataState;
  version: number;
  updatedAt: number;
}): DocumentMigrationPlan {
  const unitOfWork = buildDocumentLocalDataUnitOfWork(args);

  return {
    unitOfWork,
    sourceObjectCount: args.state.documents.length,
    projectedObjectCount: args.state.documents.length,
    missingBodyCount: args.state.documents.filter(documentObjectHasMissingBody).length,
    incompleteChunkCount: args.state.documents.filter(documentObjectHasIncompleteChunks).length,
    orphanBodyCount: args.state.documents.filter((doc) => doc.kind === 'orphan-body').length,
    expectedRepositoryRowCount: unitOfWork.mutations.length
  };
}

export function buildDocumentMigrationCensusResult(args: {
  plan: DocumentMigrationPlan;
  commitMeta: LocalDataCommitMeta;
  censusReport: LocalDataCensusReport;
}): DocumentMigrationCensusResult {
  const document = args.censusReport.domains.find((domain) => domain.domain === 'document');
  const actualRepositoryRowCount = document?.repositoryRowKeys.length ?? 0;
  const blockers = Array.from(new Set([
    ...args.censusReport.blockers.filter((blocker) => blocker.startsWith('document:')),
    ...(args.plan.missingBodyCount > 0 || args.plan.incompleteChunkCount > 0 ? ['document:missing-body'] : [])
  ]));
  const warnings = args.censusReport.warnings.filter((warning) => warning.startsWith('document:'));

  return {
    ok: actualRepositoryRowCount === args.plan.expectedRepositoryRowCount && blockers.length === 0,
    sourceObjectCount: args.plan.sourceObjectCount,
    projectedObjectCount: args.plan.projectedObjectCount,
    missingBodyCount: args.plan.missingBodyCount,
    incompleteChunkCount: args.plan.incompleteChunkCount,
    orphanBodyCount: args.plan.orphanBodyCount,
    expectedRepositoryRowCount: args.plan.expectedRepositoryRowCount,
    actualRepositoryRowCount,
    blockers,
    warnings
  };
}
