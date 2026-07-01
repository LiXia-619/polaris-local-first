import {
  type ChatDomainMetaRow,
  type CommitPointerRow,
  type ConversationCatalogRow,
  type ConversationRecordRow,
  type LocalDataMigrationValidationReport
} from './types';

export type ChatMigrationHydratedActiveConversation = {
  state: 'active';
  catalog: ConversationCatalogRow;
  record: ConversationRecordRow;
};

export type ChatMigrationHydratedQuarantinedConversation = {
  state: 'quarantined';
  id: string;
  reason: string;
};

export type ChatMigrationHydratedConversation =
  | ChatMigrationHydratedActiveConversation
  | ChatMigrationHydratedQuarantinedConversation;

export type ChatMigrationValidationArgs = {
  pointer: CommitPointerRow;
  domainMeta: ChatDomainMetaRow | null;
  legacyBaselineConversationIds: readonly string[];
  legacyActiveConversationIds: readonly string[];
  knownCollaboratorIds?: readonly string[];
  conversations: ChatMigrationHydratedConversation[];
  validatedAt: number;
  metadataDegradationReasons?: LocalDataMigrationValidationReport['metadataDegradationReasons'];
};

export function buildChatMigrationValidationReport(
  args: ChatMigrationValidationArgs
): LocalDataMigrationValidationReport {
  const activeConversations = args.conversations.filter(isActiveConversation);
  const quarantinedConversations = args.conversations.filter(isQuarantinedConversation);
  const activeConversationIds = new Set(activeConversations.map((conversation) => conversation.catalog.id));
  const quarantinedConversationIds = new Set(quarantinedConversations.map((conversation) => conversation.id));
  const allConversationIds = new Set([
    ...activeConversationIds,
    ...quarantinedConversationIds
  ]);
  const duplicateObjectIdCount = countDuplicateConversationIds(args.conversations);
  const legacyBaselineObjectIds = uniqueSortedIds(args.legacyBaselineConversationIds);
  const missingActiveCollaboratorIds = resolveMissingActiveCollaboratorIds(
    activeConversations,
    args.knownCollaboratorIds
  );
  const recoveredActiveConversationId = resolveRecoveredActiveConversationId(
    args.domainMeta,
    activeConversationIds
  );
  const activeIncompleteRowCount = activeConversations.filter((conversation) => {
    return !isActiveCatalogRecordPair(conversation.catalog, conversation.record);
  }).length;
  const stagingHydrated = args.domainMeta !== null
    && args.domainMeta.activeConversationCount === activeConversationIds.size
    && args.domainMeta.quarantinedConversationCount === quarantinedConversationIds.size
    && args.domainMeta.totalConversationCount === allConversationIds.size;

  return {
    id: `chat:${args.pointer.commitId}:validation`,
    domain: 'chat',
    commitId: args.pointer.commitId,
    version: args.pointer.version,
    validatedAt: args.validatedAt,
    stagingHydrated,
    legacyBaselineCount: legacyBaselineObjectIds.length,
    legacyBaselineObjectIds,
    activeBaselineObjectIds: uniqueSortedIds(args.legacyActiveConversationIds),
    activeObjectCount: activeConversationIds.size,
    activeObjectIds: uniqueSortedIds(activeConversationIds),
    quarantinedObjectCount: quarantinedConversationIds.size,
    quarantinedObjectIds: uniqueSortedIds(quarantinedConversationIds),
    duplicateObjectIdCount,
    missingActiveCollaboratorIdCount: missingActiveCollaboratorIds.length,
    missingActiveCollaboratorIds,
    activeIncompleteRowCount,
    activeTimedOutRowCount: 0,
    recoveredMetadata: {
      activeConversationId: recoveredActiveConversationId
    },
    metadataDegradationReasons: args.metadataDegradationReasons
  };
}

function resolveMissingActiveCollaboratorIds(
  conversations: ChatMigrationHydratedActiveConversation[],
  knownCollaboratorIds: readonly string[] | undefined
) {
  if (!knownCollaboratorIds) return [];
  const knownIds = new Set(knownCollaboratorIds);
  return uniqueSortedIds(
    conversations
      .map((conversation) => conversation.catalog.collaboratorId)
      .filter((collaboratorId): collaboratorId is string => (
        typeof collaboratorId === 'string'
        && collaboratorId.trim().length > 0
        && !knownIds.has(collaboratorId)
      ))
  );
}

function resolveRecoveredActiveConversationId(
  domainMeta: ChatDomainMetaRow | null,
  activeConversationIds: Set<string>
) {
  const activeConversationId = domainMeta?.activeConversationId ?? null;
  if (activeConversationId === null) return null;
  return activeConversationIds.has(activeConversationId)
    ? activeConversationId
    : null;
}

function countDuplicateConversationIds(conversations: ChatMigrationHydratedConversation[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const conversation of conversations) {
    const id = getHydratedConversationId(conversation);
    if (seen.has(id)) {
      duplicates.add(id);
      continue;
    }
    seen.add(id);
  }

  return duplicates.size;
}

function getHydratedConversationId(conversation: ChatMigrationHydratedConversation) {
  return conversation.state === 'active' ? conversation.catalog.id : conversation.id;
}

function uniqueSortedIds(ids: Iterable<string>) {
  return Array.from(new Set(ids)).sort();
}

function isActiveConversation(
  conversation: ChatMigrationHydratedConversation
): conversation is ChatMigrationHydratedActiveConversation {
  return conversation.state === 'active';
}

function isQuarantinedConversation(
  conversation: ChatMigrationHydratedConversation
): conversation is ChatMigrationHydratedQuarantinedConversation {
  return conversation.state === 'quarantined';
}

function isActiveCatalogRecordPair(catalog: ConversationCatalogRow, record: ConversationRecordRow) {
  return catalog.state === 'active'
    && catalog.id === record.id
    && catalog.recordVersion === record.version
    && catalog.messageCount === record.messages.length
    && catalog.latestMessageTimestamp === latestMessageTimestamp(record)
    && catalog.activeProjectId === record.ownerProjectId;
}

function latestMessageTimestamp(record: ConversationRecordRow) {
  return Math.max(0, ...record.messages.map((message) => message.timestamp));
}
