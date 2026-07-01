export type ChatPersistenceMarkerState = {
  dirtyConversationIds: string[];
  conversationPersistVersion: number;
};

export function appendConversationId(conversationIds: string[], conversationId: string) {
  return conversationIds.includes(conversationId)
    ? conversationIds
    : [...conversationIds, conversationId];
}

export function markChatIndexDirty(state: Pick<ChatPersistenceMarkerState, 'conversationPersistVersion'>) {
  return {
    conversationPersistVersion: state.conversationPersistVersion + 1
  };
}

export function markConversationDirty(state: ChatPersistenceMarkerState, conversationId: string) {
  return {
    dirtyConversationIds: appendConversationId(state.dirtyConversationIds, conversationId),
    ...markChatIndexDirty(state)
  };
}

export function markConversationsDirty(state: ChatPersistenceMarkerState, conversationIds: string[]) {
  return {
    dirtyConversationIds: conversationIds.reduce(appendConversationId, state.dirtyConversationIds),
    ...markChatIndexDirty(state)
  };
}
