type ResolveChatCollaboratorOwnerArgs = {
  frontstageCollaboratorId?: string | null;
  activeConversationCollaboratorId?: string | null;
  conversationCollaboratorId?: string | null;
  fallbackCollaboratorId?: string | null;
};

export function resolveChatCollaboratorOwnerId({
  frontstageCollaboratorId,
  activeConversationCollaboratorId,
  conversationCollaboratorId,
  fallbackCollaboratorId
}: ResolveChatCollaboratorOwnerArgs) {
  return frontstageCollaboratorId
    ?? activeConversationCollaboratorId
    ?? conversationCollaboratorId
    ?? fallbackCollaboratorId
    ?? undefined;
}
