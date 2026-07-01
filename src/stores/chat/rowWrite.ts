import type { Conversation } from '../../types/domain';
import {
  buildConversationLocalDataProjection,
  getConversationCatalogLocalDataRef,
  getConversationRecordLocalDataRef,
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataUnitMutation
} from '../../engines/localData';
import { runExclusiveChatPersistenceCommit } from '../chatPersistenceCommitQueue';
import { isChatLocalDataRepositoryActive } from './read';
import {
  buildRefreshedChatDomainMetaRow,
  buildUnloadedConversationCatalogUpdate,
  collectChatCatalogStateIds,
  overlayChatCatalogState,
  readChatDomainMetaValue,
  type ChatCatalogStateIds
} from './writeHelpers';
import { createStoreLocalDataRepository } from '../localDataStorePersistence';

export type ChatConversationRowChange =
  | { type: 'upsertRecord'; conversation: Conversation }
  | { type: 'upsertMetadata'; conversation: Conversation }
  | { type: 'delete'; conversationId: string };

/**
 * Write a set of single-conversation changes together with the
 * active-conversation pointer in one unit of work. An interactive action that
 * edits one conversation and moves the active pointer (creating a conversation
 * and selecting it, or deleting the active one) is one atomic commit rather than
 * two, and a multi-conversation batch (workspace reconcile, attachment clearing)
 * writes all of its changed rows plus the refreshed domain meta in one commit.
 *
 * The active-conversation pointer is recorded verbatim from the store's truth;
 * switching it is the caller's responsibility, not something resolved here.
 *
 * Returns false only when the chat repository is inactive (the caller then uses the
 * snapshot/legacy write path). A change set that writes the same conversation twice,
 * or a metadata edit for a conversation whose catalog no longer exists, is a caller
 * or store/repository inconsistency and throws rather than being silently skipped.
 * Retired group shells are turned into delete changes by the caller, so this writer
 * never sees a retired group as an upsert.
 */
export async function commitChatConversationRowChangesIfActive(args: {
  changes: ChatConversationRowChange[];
  activeConversationId: string | null;
}): Promise<boolean> {
  return runExclusiveChatPersistenceCommit(async () => {
    if (!(await isChatLocalDataRepositoryActive())) return false;
    await commitChatConversationRowChanges(args);
    return true;
  });
}

async function commitChatConversationRowChanges(args: {
  changes: ChatConversationRowChange[];
  activeConversationId: string | null;
}): Promise<void> {
  const now = Date.now();
  const repository = createStoreLocalDataRepository();
  const catalogStateIds = await collectChatCatalogStateIds(repository);
  const conversationMutations: LocalDataUnitMutation[] = [];
  const touchedConversationIds = new Set<string>();

  for (const change of args.changes) {
    const conversationId = change.type === 'delete' ? change.conversationId : change.conversation.id;
    if (touchedConversationIds.has(conversationId)) {
      throw new Error(`Chat row change set writes the same conversation twice: ${conversationId}`);
    }
    touchedConversationIds.add(conversationId);

    conversationMutations.push(...await buildChatConversationChangeMutations({
      change,
      repository,
      catalogStateIds,
      now
    }));
  }

  const previousMeta = await readChatDomainMetaValue(repository);
  const domainMetaRow = buildRefreshedChatDomainMetaRow({
    previous: previousMeta,
    catalogStateIds,
    activeConversationId: args.activeConversationId,
    updatedAt: now
  });

  await repository.commit({
    domain: 'chat',
    version: LOCAL_DATA_SCHEMA_VERSION,
    mutations: [
      { type: 'put', row: domainMetaRow },
      ...conversationMutations
    ]
  });
}

/**
 * Build the row mutations for one conversation change, applying its catalog-state
 * overlay to `catalogStateIds` so the caller can compute the domain meta once for
 * the whole batch.
 */
async function buildChatConversationChangeMutations(args: {
  change: ChatConversationRowChange;
  repository: ReturnType<typeof createStoreLocalDataRepository>;
  catalogStateIds: ChatCatalogStateIds;
  now: number;
}): Promise<LocalDataUnitMutation[]> {
  const { change, repository, catalogStateIds, now } = args;

  if (change.type === 'upsertRecord') {
    const projection = buildConversationLocalDataProjection({
      conversation: change.conversation,
      bodyState: 'complete',
      version: LOCAL_DATA_SCHEMA_VERSION,
      committedAt: now
    });
    overlayChatCatalogState(catalogStateIds, change.conversation.id, 'active');
    return [
      { type: 'put', row: projection.catalogRow },
      ...(projection.recordRow ? [{ type: 'put' as const, row: projection.recordRow }] : [])
    ];
  }

  if (change.type === 'upsertMetadata') {
    const catalogRow = await buildUnloadedConversationCatalogUpdate(change.conversation, repository, now, 'active');
    if (!catalogRow) {
      throw new Error(`Chat metadata edit has no live catalog to update: ${change.conversation.id}`);
    }
    overlayChatCatalogState(catalogStateIds, change.conversation.id, catalogRow.value.state);
    return [{ type: 'put', row: catalogRow }];
  }

  catalogStateIds.activeIds.delete(change.conversationId);
  catalogStateIds.quarantinedIds.delete(change.conversationId);
  return [
    {
      type: 'tombstone',
      ref: getConversationCatalogLocalDataRef(change.conversationId),
      version: LOCAL_DATA_SCHEMA_VERSION,
      deletedAt: now
    },
    {
      type: 'tombstone',
      ref: getConversationRecordLocalDataRef(change.conversationId),
      version: LOCAL_DATA_SCHEMA_VERSION,
      deletedAt: now
    }
  ];
}
