import {
  buildChatMigrationValidationReport,
  type ChatMigrationHydratedConversation,
  type ChatMigrationValidationArgs
} from './chatMigrationValidation';
import type {
  ChatDomainMetaRow,
  CommitPointerRow,
  ConversationCatalogRow,
  ConversationRecordRow,
  LocalDataRef,
  LocalDataMigrationValidationReport,
  LocalDataReadResult
} from './types';

export type ChatMigrationHydrateRowPair = {
  id: string;
  catalog: LocalDataReadResult<ConversationCatalogRow>;
  record?: LocalDataReadResult<ConversationRecordRow>;
};

export type ChatMigrationHydrateValidationArgs = {
  pointer: CommitPointerRow;
  domainMeta: LocalDataReadResult<ChatDomainMetaRow>;
  legacyBaselineConversationIds: readonly string[];
  legacyActiveConversationIds: readonly string[];
  knownCollaboratorIds?: readonly string[];
  rows: ChatMigrationHydrateRowPair[];
  validatedAt: number;
  metadataDegradationReasons?: LocalDataMigrationValidationReport['metadataDegradationReasons'];
};

export function buildChatMigrationValidationReportFromRows(
  args: ChatMigrationHydrateValidationArgs
): LocalDataMigrationValidationReport {
  return buildChatMigrationValidationReport({
    pointer: args.pointer,
    domainMeta: resolveCompleteDomainMeta(args.domainMeta),
    legacyBaselineConversationIds: args.legacyBaselineConversationIds,
    legacyActiveConversationIds: args.legacyActiveConversationIds,
    knownCollaboratorIds: args.knownCollaboratorIds,
    conversations: hydrateChatMigrationConversations(args.rows),
    validatedAt: args.validatedAt,
    metadataDegradationReasons: args.metadataDegradationReasons
  });
}

export function hydrateChatMigrationConversations(
  rows: ChatMigrationHydrateRowPair[]
): ChatMigrationHydratedConversation[] {
  return rows.map((row) => hydrateChatMigrationConversation(row));
}

function hydrateChatMigrationConversation(
  row: ChatMigrationHydrateRowPair
): ChatMigrationHydratedConversation {
  if (row.catalog.status !== 'complete') {
    return quarantineConversation(row.id, `conversation catalog is ${row.catalog.status}`);
  }

  if (!completeRowIdentityMatches(getConversationCatalogExpectedRef(row.id), row.catalog)) {
    return quarantineConversation(row.id, 'conversation catalog identity does not match its row');
  }

  const catalog = row.catalog.value;
  if (catalog.state !== 'active') {
    return quarantineConversation(catalog.id, `conversation catalog state is ${catalog.state}`);
  }

  if (!row.record) {
    return quarantineConversation(catalog.id, 'conversation record was not read');
  }
  if (row.record.status !== 'complete') {
    return quarantineConversation(catalog.id, `conversation record is ${row.record.status}`);
  }
  if (!completeRowIdentityMatches(getConversationRecordExpectedRef(catalog.id), row.record)) {
    return quarantineConversation(catalog.id, 'conversation record identity does not match its row');
  }

  return {
    state: 'active',
    catalog,
    record: row.record.value
  };
}

function resolveCompleteDomainMeta(domainMeta: LocalDataReadResult<ChatDomainMetaRow>) {
  return domainMeta.status === 'complete' ? domainMeta.value : null;
}

function completeRowIdentityMatches(
  expectedRef: LocalDataRef,
  read: LocalDataReadResult<ConversationCatalogRow | ConversationRecordRow>
) {
  return read.status === 'complete'
    && refsMatch(read.ref, expectedRef)
    && refsMatch(read.row.ref, expectedRef)
    && read.value.id === expectedRef.id;
}

function refsMatch(left: LocalDataRef, right: LocalDataRef) {
  return left.domain === right.domain
    && left.kind === right.kind
    && left.id === right.id;
}

function getConversationCatalogExpectedRef(id: string): LocalDataRef {
  return {
    domain: 'chat',
    kind: 'conversationCatalog',
    id
  };
}

function getConversationRecordExpectedRef(id: string): LocalDataRef {
  return {
    domain: 'chat',
    kind: 'conversationRecord',
    id
  };
}

function quarantineConversation(id: string, reason: string): ChatMigrationHydratedConversation {
  return {
    state: 'quarantined',
    id,
    reason
  };
}
