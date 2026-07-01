import { isCompanionCollaboratorId } from '../../engines/companion';
import type { ChatMessage, Conversation, Persona } from '../../types/domain';

export type ConversationSession = {
  conversationId: string;
  collaboratorId: string;
  messages: ChatMessage[];
};

type ConversationSessionState = {
  activeConversation: {
    id: string;
    collaboratorId: string | null;
    messages: ChatMessage[];
  } | null;
  activeCollaboratorId: string | null;
  personas: Persona[];
};

type ConversationSessionWriter = {
  createConversation: (
    collaboratorId?: string | null,
    options?: {
      activeProjectId?: string | null;
    }
  ) => string;
};

type CollaboratorConversationState = {
  conversations: Pick<Conversation, 'id' | 'collaboratorId' | 'activeProjectId'>[];
  personas: Persona[];
  activeCollaboratorId: string | null;
};

type CollaboratorConversationWriter = {
  createConversation: (
    collaboratorId?: string | null,
    options?: {
      activeProjectId?: string | null;
    }
  ) => string;
  setActiveConversation: (conversationId: string) => void;
  clearPendingCardReference?: () => void;
  clearPendingAttachments?: () => void;
};

export type CollaboratorConversationResolution = {
  conversationId: string;
  collaboratorId: string | null;
  created: boolean;
};

type CollaboratorConversationOrphanState = {
  collaboratorId: string;
  conversations: Pick<Conversation, 'id' | 'collaboratorId'>[];
  personas: Persona[];
  activeCollaboratorId: string | null;
  activeConversationId: string | null;
};

type CollaboratorConversationOrphanWriter = CollaboratorConversationWriter & {
  orphanConversation: (conversationId: string) => void;
  rollbackPreviewForConversationDeletion?: (conversationId: string) => boolean;
};

export type CollaboratorConversationOrphanResolution = {
  orphanedConversationIds: string[];
  nextCollaboratorId: string | null;
  nextConversationId: string | null;
};

export function resolveDefaultCollaboratorId(
  personas: Persona[],
  activeCollaboratorId: string | null,
  excludedCollaboratorId?: string | null
): string | null {
  if (
    activeCollaboratorId
    && activeCollaboratorId !== excludedCollaboratorId
    && (isCompanionCollaboratorId(activeCollaboratorId) || personas.some((persona) => persona.id === activeCollaboratorId))
  ) {
    return activeCollaboratorId;
  }

  return personas.find((persona) => persona.id !== excludedCollaboratorId)?.id ?? null;
}

export function createConversationForCollaborator(
  writer: ConversationSessionWriter,
  personas: Persona[],
  activeCollaboratorId: string | null,
  collaboratorId?: string | null
) {
  return writer.createConversation(
    resolveDefaultCollaboratorId(personas, collaboratorId ?? activeCollaboratorId, null)
  );
}

export function ensureConversationSession(
  state: ConversationSessionState,
  writer: ConversationSessionWriter
): ConversationSession | null {
  if (state.activeConversation && state.activeConversation.collaboratorId !== null) {
    return {
      conversationId: state.activeConversation.id,
      collaboratorId: state.activeConversation.collaboratorId,
      messages: state.activeConversation.messages
    };
  }

  const collaboratorId = resolveDefaultCollaboratorId(state.personas, state.activeCollaboratorId, null);
  if (!collaboratorId) return null;
  return {
    conversationId: createConversationForCollaborator(writer, state.personas, state.activeCollaboratorId, collaboratorId),
    collaboratorId,
    messages: []
  };
}

export function openConversationForCollaborator(
  state: CollaboratorConversationState,
  writer: CollaboratorConversationWriter,
  collaboratorId?: string | null,
  options?: {
    preferredProjectId?: string | null;
  }
): CollaboratorConversationResolution {
  const resolvedCollaboratorId = resolveDefaultCollaboratorId(
    state.personas,
    collaboratorId ?? state.activeCollaboratorId,
    null
  );
  const preferredProjectId = options?.preferredProjectId?.trim() || null;
  const existingConversation = preferredProjectId
    ? state.conversations.find(
        (conversation) =>
          conversation.collaboratorId === resolvedCollaboratorId
          && (conversation.activeProjectId ?? null) === preferredProjectId
      ) ?? null
    : state.conversations.find(
        (conversation) =>
          conversation.collaboratorId === resolvedCollaboratorId
          && (conversation.activeProjectId ?? null) === null
      ) ?? null;

  if (existingConversation) {
    writer.clearPendingAttachments?.();
    writer.clearPendingCardReference?.();
    writer.setActiveConversation(existingConversation.id);
    return {
      conversationId: existingConversation.id,
      collaboratorId: resolvedCollaboratorId,
      created: false
    };
  }

  writer.clearPendingAttachments?.();
  writer.clearPendingCardReference?.();
  return {
    conversationId: writer.createConversation(resolvedCollaboratorId, {
      activeProjectId: preferredProjectId
    }),
    collaboratorId: resolvedCollaboratorId,
    created: true
  };
}

export function orphanCollaboratorConversationSessions(
  state: CollaboratorConversationOrphanState,
  writer: CollaboratorConversationOrphanWriter
): CollaboratorConversationOrphanResolution {
  const orphanedConversationIds = state.conversations
    .filter((conversation) => conversation.collaboratorId === state.collaboratorId)
    .map((conversation) => conversation.id);
  const nextPersonas = state.personas.filter((persona) => persona.id !== state.collaboratorId);
  const nextCollaboratorId = nextPersonas.length > 0
    ? resolveDefaultCollaboratorId(
        nextPersonas,
        state.activeCollaboratorId === state.collaboratorId ? null : state.activeCollaboratorId,
        null
      )
    : null;

  orphanedConversationIds.forEach((conversationId) => {
    writer.rollbackPreviewForConversationDeletion?.(conversationId);
    writer.orphanConversation(conversationId);
  });

  if (!state.activeConversationId || !orphanedConversationIds.includes(state.activeConversationId) || !nextCollaboratorId) {
    return {
      orphanedConversationIds,
      nextCollaboratorId,
      nextConversationId: null
    };
  }

  const nextConversation = openConversationForCollaborator({
    conversations: state.conversations.filter((conversation) => conversation.collaboratorId !== state.collaboratorId),
    personas: nextPersonas,
    activeCollaboratorId: nextCollaboratorId
  }, {
    createConversation: writer.createConversation,
    setActiveConversation: writer.setActiveConversation,
    clearPendingCardReference: writer.clearPendingCardReference,
    clearPendingAttachments: writer.clearPendingAttachments
  }, nextCollaboratorId);

  return {
    orphanedConversationIds,
    nextCollaboratorId,
    nextConversationId: nextConversation.conversationId
  };
}
