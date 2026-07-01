import type { Conversation, GroupChatRoom } from '../../types/domain';
import {
  buildChatDomainMetaLocalDataRow,
  buildConversationLocalDataProjection,
  getConversationCatalogLocalDataRef,
  getConversationRecordLocalDataRef,
  LOCAL_DATA_SCHEMA_VERSION,
  type ConversationCatalogState,
  type LocalDataUnitMutation
} from '../../engines/localData';
import { isRetiredGroupConversation } from '../../engines/conversationOwnership';
import { createStoreLocalDataRepository } from '../localDataStorePersistence';
import { isChatLocalDataRepositoryActive } from './read';
import {
  buildUnloadedConversationCatalogUpdate,
  collectActiveLocalDataCatalogIds,
  collectChatCatalogLifecycleCountsWithOverlay,
  resolveWritableActiveConversationId,
  uniqueConversationIds,
  type ChatActivePointerWriteMode
} from './writeHelpers';

export type ChatLocalDataWriteParams = {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeGroupRoomId?: string | null;
  groupRooms?: GroupChatRoom[];
  allowNullActiveConversationId?: boolean;
  dirtyConversationIds?: string[];
  loadedConversationIds?: string[];
  deletedConversationIds?: string[];
  quarantinedConversationIds?: string[];
};

export async function writeChatStateToLocalDataRepositoryIfActive(
  params: ChatLocalDataWriteParams
): Promise<boolean> {
  if (!(await isChatLocalDataRepositoryActive())) return false;

  await writeChatStateToLocalDataRepository(params, 'active');
  return true;
}

export async function writeChatStateToLocalDataRepository(
  params: ChatLocalDataWriteParams,
  mode: 'active' | 'overlay' = 'overlay',
  activePointerMode: ChatActivePointerWriteMode = 'strict'
): Promise<void> {
  await writeChatStateToLocalDataRepositoryRows(params, mode, activePointerMode);
}

async function writeChatStateToLocalDataRepositoryRows(
  params: ChatLocalDataWriteParams,
  mode: 'active' | 'overlay',
  activePointerMode: ChatActivePointerWriteMode
) {
  const now = Date.now();
  const retiredGroupConversationIds = params.conversations
    .filter(isRetiredGroupConversation)
    .map((conversation) => conversation.id);
  const writableConversations = params.conversations.filter((conversation) => !isRetiredGroupConversation(conversation));
  const activeConversationIds = new Set(writableConversations.map((conversation) => conversation.id));
  const dirtyConversationIds = new Set(params.dirtyConversationIds ?? params.conversations.map((conversation) => conversation.id));
  const loadedConversationIds = params.loadedConversationIds ? new Set(params.loadedConversationIds) : null;
  const deletedConversationIds = uniqueConversationIds([
    ...(params.deletedConversationIds ?? []),
    ...(params.quarantinedConversationIds ?? []),
    ...retiredGroupConversationIds
  ])
    .filter((conversationId) => !activeConversationIds.has(conversationId));
  const deletedConversationIdSet = new Set(deletedConversationIds);
  const repository = createStoreLocalDataRepository();
  const existingActiveCatalogIds = await collectActiveLocalDataCatalogIds(repository);
  const conversationMutations: LocalDataUnitMutation[] = [];
  const nextActiveCatalogIds = new Set(existingActiveCatalogIds);
  // Track the post-commit catalog state of each conversation this write touches, so the
  // domain meta counts reflect the real lifecycle (active vs quarantined-ish) instead of a
  // hardcoded zero.
  const overlayCatalogStates = new Map<string, ConversationCatalogState>();

  for (const conversation of writableConversations) {
    if (deletedConversationIdSet.has(conversation.id)) continue;
    if (!dirtyConversationIds.has(conversation.id)) continue;

    const isLoaded = loadedConversationIds ? loadedConversationIds.has(conversation.id) : true;
    if (!isLoaded) {
      const catalogRow = await buildUnloadedConversationCatalogUpdate(conversation, repository, now, mode);
      if (catalogRow) {
        conversationMutations.push({ type: 'put', row: catalogRow });
        nextActiveCatalogIds.add(conversation.id);
        overlayCatalogStates.set(conversation.id, catalogRow.value.state);
      }
      continue;
    }

    const projection = buildConversationLocalDataProjection({
      conversation,
      bodyState: 'complete',
      version: LOCAL_DATA_SCHEMA_VERSION,
      committedAt: now
    });
    conversationMutations.push(
      { type: 'put', row: projection.catalogRow },
      ...(projection.recordRow ? [{ type: 'put' as const, row: projection.recordRow }] : [])
    );
    nextActiveCatalogIds.add(conversation.id);
    // A complete (loaded) projection always produces an `active` catalog row.
    overlayCatalogStates.set(conversation.id, 'active');
  }
  for (const conversationId of deletedConversationIds) {
    nextActiveCatalogIds.delete(conversationId);
  }

  const counts = await collectChatCatalogLifecycleCountsWithOverlay(
    repository,
    overlayCatalogStates,
    deletedConversationIdSet
  );
  const domainMetaRow = buildChatDomainMetaLocalDataRow({
    activeConversationId: resolveWritableActiveConversationId({
      activeConversationId: params.activeConversationId,
      activeConversationIds: nextActiveCatalogIds,
      allowNullActiveConversationId: params.allowNullActiveConversationId ?? false,
      mode: activePointerMode
    }),
    activeGroupRoomId: null,
    groupRooms: [],
    activeConversationCount: counts.activeCount,
    quarantinedConversationCount: counts.otherCount,
    totalConversationCount: counts.activeCount + counts.otherCount,
    version: LOCAL_DATA_SCHEMA_VERSION,
    updatedAt: now
  });
  const tombstoneMutations: LocalDataUnitMutation[] = deletedConversationIds.flatMap((conversationId) => [
    {
      type: 'tombstone' as const,
      ref: getConversationCatalogLocalDataRef(conversationId),
      version: LOCAL_DATA_SCHEMA_VERSION,
      deletedAt: now
    },
    {
      type: 'tombstone' as const,
      ref: getConversationRecordLocalDataRef(conversationId),
      version: LOCAL_DATA_SCHEMA_VERSION,
      deletedAt: now
    }
  ]);
  const unitOfWork = {
    domain: 'chat' as const,
    version: LOCAL_DATA_SCHEMA_VERSION,
    mutations: [
      { type: 'put' as const, row: domainMetaRow },
      ...conversationMutations,
      ...tombstoneMutations
    ]
  };
  await repository.commit(unitOfWork);
}
