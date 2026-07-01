import {
  buildChatMigrationRehearsalValidationReport,
  type ChatMigrationRehearsal,
  type ChatMigrationRehearsalReadback
} from './chatMigrationRehearsal';
import type { LocalDataRepository } from './repository';
import type {
  ChatDomainMetaRow,
  CommitPointerRow,
  ConversationCatalogRow,
  ConversationRecordRow,
  LocalDataCommitMeta,
  LocalDataMigrationValidationReport
} from './types';

export type ChatMigrationReadbackResult = {
  commitMeta: LocalDataCommitMeta;
  readback: ChatMigrationRehearsalReadback;
  validationReport: LocalDataMigrationValidationReport;
};

export async function commitChatMigrationRehearsalAndBuildValidationReport(args: {
  repository: LocalDataRepository;
  rehearsal: ChatMigrationRehearsal;
  validatedAt: number;
}): Promise<ChatMigrationReadbackResult> {
  const commitMeta = await args.repository.commit(args.rehearsal.unitOfWork);
  const readback = await readChatMigrationRehearsal({
    repository: args.repository,
    rehearsal: args.rehearsal,
    pointer: commitMetaToPointer(commitMeta),
    validatedAt: args.validatedAt
  });

  return {
    commitMeta,
    readback,
    validationReport: buildChatMigrationRehearsalValidationReport(args.rehearsal, readback)
  };
}

export async function readChatMigrationRehearsal(args: {
  repository: LocalDataRepository;
  rehearsal: ChatMigrationRehearsal;
  pointer: CommitPointerRow;
  validatedAt: number;
}): Promise<ChatMigrationRehearsalReadback> {
  const domainMeta = await args.repository.read<ChatDomainMetaRow>(
    args.rehearsal.readPlan.domainMetaRef
  );
  const rows = await Promise.all(args.rehearsal.readPlan.conversations.map(async (plan) => {
    const catalog = await args.repository.read<ConversationCatalogRow>(plan.catalogRef);
    const record = plan.recordRef
      ? await args.repository.read<ConversationRecordRow>(plan.recordRef)
      : undefined;

    return {
      id: plan.id,
      catalog,
      ...(record ? { record } : {})
    };
  }));

  return {
    pointer: args.pointer,
    domainMeta,
    rows,
    validatedAt: args.validatedAt
  };
}

function commitMetaToPointer(meta: LocalDataCommitMeta): CommitPointerRow {
  return {
    domain: meta.domain,
    version: meta.version,
    committedAt: meta.committedAt,
    commitId: meta.commitId
  };
}
