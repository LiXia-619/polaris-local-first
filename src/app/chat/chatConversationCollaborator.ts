import type { ChatMessage } from '../../types/domain';

export type ActiveConversationCollaborator = {
  id: string;
  collaboratorId: string | null;
};

export type ActiveConversationCollaboratorSession = ActiveConversationCollaborator & {
  messages: ChatMessage[];
};

export function toActiveConversationCollaborator(
  conversation: { id: string; collaboratorId: string | null } | null
): ActiveConversationCollaborator | null {
  if (!conversation) return null;
  return {
    id: conversation.id,
    collaboratorId: conversation.collaboratorId
  };
}

export function toActiveConversationCollaboratorSession(
  conversation: { id: string; collaboratorId: string | null; messages: ChatMessage[] } | null
): ActiveConversationCollaboratorSession | null {
  if (!conversation) return null;
  return {
    id: conversation.id,
    collaboratorId: conversation.collaboratorId,
    messages: conversation.messages
  };
}
