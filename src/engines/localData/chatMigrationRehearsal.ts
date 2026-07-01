import {
  buildConversationLocalDataUnitOfWork,
  getChatDomainMetaLocalDataRef,
  getConversationCatalogLocalDataRef,
  getConversationRecordLocalDataRef
} from './chatRows';
import {
  buildChatMigrationValidationReportFromRows,
  type ChatMigrationHydrateRowPair
} from './chatMigrationHydration';
import {
  planChatMigrationFromLegacySnapshot,
  type ChatMigrationLegacySnapshot,
  type ChatMigrationPlan
} from './chatMigrationPlanner';
import type {
  ChatDomainMetaRow,
  CommitPointerRow,
  ConversationCatalogRow,
  ConversationRecordRow,
  LocalDataMigrationValidationReport,
  LocalDataReadResult,
  LocalDataRef,
  LocalDataUnitOfWork
} from './types';

export class ChatMigrationRehearsalContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatMigrationRehearsalContractError';
  }
}

export type ChatMigrationRehearsalConversationReadPlan = {
  id: string;
  catalogRef: LocalDataRef;
  recordRef?: LocalDataRef;
};

export type ChatMigrationRehearsalReadPlan = {
  domainMetaRef: LocalDataRef;
  conversations: ChatMigrationRehearsalConversationReadPlan[];
};

export type ChatMigrationRehearsal = {
  plan: ChatMigrationPlan;
  unitOfWork: LocalDataUnitOfWork;
  readPlan: ChatMigrationRehearsalReadPlan;
  knownCollaboratorIds?: readonly string[];
};

export type ChatMigrationRehearsalArgs = {
  snapshot: ChatMigrationLegacySnapshot;
  version: number;
  committedAt: number;
  unitId?: string;
  knownCollaboratorIds?: readonly string[];
};

export type ChatMigrationRehearsalReadback = {
  pointer: CommitPointerRow;
  domainMeta: LocalDataReadResult<ChatDomainMetaRow>;
  rows: ChatMigrationHydrateRowPair[];
  validatedAt: number;
};

export function buildChatMigrationRehearsal(args: ChatMigrationRehearsalArgs): ChatMigrationRehearsal {
  const plan = planChatMigrationFromLegacySnapshot({
    snapshot: args.snapshot,
    version: args.version,
    committedAt: args.committedAt
  });
  const unitOfWork = buildConversationLocalDataUnitOfWork({
    id: args.unitId,
    activeConversationId: plan.activeConversationId,
    conversations: plan.conversations,
    version: args.version,
    updatedAt: args.committedAt
  });

  return {
    plan,
    unitOfWork,
    readPlan: buildChatMigrationRehearsalReadPlan(plan),
    knownCollaboratorIds: args.knownCollaboratorIds
  };
}

export function buildChatMigrationRehearsalValidationReport(
  rehearsal: ChatMigrationRehearsal,
  readback: ChatMigrationRehearsalReadback
): LocalDataMigrationValidationReport {
  assertReadbackFollowsRehearsal(rehearsal, readback.rows);
  return buildChatMigrationValidationReportFromRows({
    pointer: readback.pointer,
    domainMeta: readback.domainMeta,
    legacyBaselineConversationIds: rehearsal.plan.legacyBaselineConversationIds,
    legacyActiveConversationIds: rehearsal.plan.legacyActiveConversationIds,
    knownCollaboratorIds: rehearsal.knownCollaboratorIds,
    rows: readback.rows,
    validatedAt: readback.validatedAt,
    metadataDegradationReasons: rehearsal.plan.metadataDegradationReasons
  });
}

function buildChatMigrationRehearsalReadPlan(plan: ChatMigrationPlan): ChatMigrationRehearsalReadPlan {
  return {
    domainMetaRef: getChatDomainMetaLocalDataRef(),
    conversations: plan.conversations.map((conversation) => ({
      id: conversation.conversation.id,
      catalogRef: getConversationCatalogLocalDataRef(conversation.conversation.id),
      ...(conversation.bodyState === 'complete'
        ? { recordRef: getConversationRecordLocalDataRef(conversation.conversation.id) }
        : {})
    }))
  };
}

function assertReadbackFollowsRehearsal(
  rehearsal: ChatMigrationRehearsal,
  rows: ChatMigrationHydrateRowPair[]
) {
  const plannedRows = new Map(
    rehearsal.readPlan.conversations.map((row) => [row.id, row])
  );
  const seenRows = new Set<string>();

  for (const row of rows) {
    const plannedRow = plannedRows.get(row.id);
    if (!plannedRow) {
      throw new ChatMigrationRehearsalContractError(
        `Chat migration readback contains an unplanned conversation row: ${row.id}`
      );
    }
    if (seenRows.has(row.id)) {
      throw new ChatMigrationRehearsalContractError(
        `Chat migration readback contains duplicate conversation row evidence: ${row.id}`
      );
    }
    seenRows.add(row.id);
    assertReadbackCatalogRef(plannedRow.catalogRef, row.catalog.ref, row.id);
    if (plannedRow.recordRef) {
      if (!row.record) {
        throw new ChatMigrationRehearsalContractError(
          `Chat migration readback is missing complete record evidence: ${row.id}`
        );
      }
      assertReadbackRecordRef(plannedRow.recordRef, row.record.ref, row.id);
      continue;
    }
    if (row.record) {
      throw new ChatMigrationRehearsalContractError(
        `Chat migration readback supplied record evidence for a non-complete row: ${row.id}`
      );
    }
  }

  for (const plannedRow of rehearsal.readPlan.conversations) {
    if (!seenRows.has(plannedRow.id)) {
      throw new ChatMigrationRehearsalContractError(
        `Chat migration readback is missing planned conversation row: ${plannedRow.id}`
      );
    }
  }
}

function assertReadbackCatalogRef(expected: LocalDataRef, actual: LocalDataRef, id: string) {
  if (refsMatch(expected, actual)) return;
  throw new ChatMigrationRehearsalContractError(
    `Chat migration catalog readback ref does not match the rehearsal plan: ${id}`
  );
}

function assertReadbackRecordRef(expected: LocalDataRef, actual: LocalDataRef, id: string) {
  if (refsMatch(expected, actual)) return;
  throw new ChatMigrationRehearsalContractError(
    `Chat migration record readback ref does not match the rehearsal plan: ${id}`
  );
}

function refsMatch(left: LocalDataRef, right: LocalDataRef) {
  return left.domain === right.domain
    && left.kind === right.kind
    && left.id === right.id;
}
