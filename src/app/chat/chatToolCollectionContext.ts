import {
  filterCodeCardsForCollaboratorScope,
  filterProjectFilesForCollaboratorScope
} from '../../engines/collectionOwnership';
import { findPreferredProjectFile, normalizeCodeCardFilePath } from '../../engines/roomProjects';
import type { ToolContext } from '../../engines/toolExecutorTypes';
import type {
  ChatSpaceFrontstagePort,
  ToolActionChatState,
  ToolActionCollectionState
} from './chatToolActionTypes';
import { enterConversationWorkspaceScope } from '../shell/workspaceNavigation';
import { readWorkspaceReferenceDocContent } from '../../stores/workspaceReferenceDocContentPersistence';

type CollectionToolContextPorts = Pick<
  ToolContext,
  | 'createRoomProject'
  | 'readRoomProject'
  | 'patchRoomProject'
  | 'listCodeCards'
  | 'listProjectFiles'
  | 'createCodeCard'
  | 'createProjectFile'
  | 'promoteCardToProject'
  | 'patchCodeCard'
  | 'patchProjectFile'
  | 'deleteProjectFile'
  | 'selectCodeCard'
  | 'spotlightCodeCard'
  | 'readCodeCard'
  | 'readProjectFile'
  | 'listWorkspaceReferenceDocs'
  | 'readWorkspaceReferenceDoc'
  | 'readWorkspaceReferenceDocContent'
  | 'createWorkspaceReferenceDoc'
  | 'deleteWorkspaceReferenceDoc'
>;

type CollectionToolContextArgs = {
  chat: Pick<
    ToolActionChatState,
    | 'conversations'
    | 'findConversation'
    | 'setConversationActiveProject'
  >;
  collection: ToolActionCollectionState;
  space: Pick<ChatSpaceFrontstagePort, 'setActiveCard' | 'spotlightCard'>;
  conversationId: string;
  ownerCollaboratorId: string | null | undefined;
  activeProjectId: string | null;
  writeOwnerCollaboratorId: string | undefined;
};

export function buildCollectionToolContextPorts({
  chat,
  collection,
  space,
  conversationId,
  ownerCollaboratorId,
  activeProjectId,
  writeOwnerCollaboratorId
}: CollectionToolContextArgs): CollectionToolContextPorts {
  const getLatestCollectionState = () => collection.readLatestState();
  const latestCollectionState = getLatestCollectionState();
  // 群聊是共享工作区：成员能看见、能改本群产出的所有卡片，而不是只看自己名下的。
  // 群的产物按血缘（lineage）归属：同一个群开的多场子对话共享一套卡片。
  const activeConversationRecord = chat.conversations.find((conversation) => conversation.id === conversationId);
  const isGroupScope = activeConversationRecord?.kind === 'group';
  const groupLineageId = isGroupScope
    ? activeConversationRecord?.group?.lineageId ?? conversationId
    : null;
  const lineageConversationIds = groupLineageId
    ? new Set(
        chat.conversations
          .filter((conversation) =>
            conversation.kind === 'group'
            && (conversation.group?.lineageId ?? conversation.id) === groupLineageId)
          .map((conversation) => conversation.id)
      )
    : null;
  const scopeCards = (cards: typeof latestCollectionState.cards) => lineageConversationIds
    ? cards.filter((card) => card.originConversationId && lineageConversationIds.has(card.originConversationId))
    : filterCodeCardsForCollaboratorScope(cards, chat.conversations, ownerCollaboratorId);
  const accessibleCards = scopeCards(latestCollectionState.cards);

  return {
    createRoomProject: (project) => collection.createProject({
      ...project,
      ownerCollaboratorId: writeOwnerCollaboratorId,
      source: 'chat-generated'
    }),
    readRoomProject: (projectId) =>
      getLatestCollectionState().roomProjects.find((project) => project.id === projectId) ?? null,
    patchRoomProject: (projectId, patch) => {
      const exists = getLatestCollectionState().roomProjects.some((project) => project.id === projectId);
      if (!exists) return false;
      collection.updateProject(projectId, patch);
      return true;
    },
    listCodeCards: () => scopeCards(getLatestCollectionState().cards),
    listProjectFiles: (projectId) =>
      filterProjectFilesForCollaboratorScope(
        getLatestCollectionState().projectFiles,
        ownerCollaboratorId,
        activeProjectId
      ).filter((file) => file.projectId === projectId),
    createCodeCard: (card) => {
      return collection.createCard({
        ...card,
        ownerCollaboratorId: writeOwnerCollaboratorId,
        // 没有出生地的卡片在群里等于不存在：群卡片架和下一轮模型可见性都按 origin 圈
        originConversationId: conversationId,
        source: 'chat-generated'
      });
    },
    createProjectFile: (file) => {
      const projectId = file.projectId.trim();
      const filePath = normalizeCodeCardFilePath(file.filePath);
      if (!projectId || !filePath) return null;

      const latestCollectionState = getLatestCollectionState();
      const projectExists = latestCollectionState.roomProjects.some((project) => project.id === projectId);
      if (!projectExists) return null;

      const latestProjectFiles = latestCollectionState.projectFiles;
      const existingProjectFileMatch = findPreferredProjectFile({
        projectFiles: latestProjectFiles,
        projectId,
        filePath
      });
      if (existingProjectFileMatch.duplicateCount > 1 && !existingProjectFileMatch.usedPreferredFile) {
        return null;
      }
      const existingProjectFile = existingProjectFileMatch.file;

      if (existingProjectFile) {
        collection.updateProjectFile(existingProjectFile.id, {
          fileRole: file.fileRole,
          language: file.language,
          content:
            file.replaceContent || file.code
              ? file.code
              : existingProjectFile.content,
          ownerCollaboratorId: writeOwnerCollaboratorId,
          source: 'chat-generated'
        });
        return existingProjectFile.id;
      }

      return collection.createProjectFile({
        projectId,
        filePath,
        fileRole: file.fileRole,
        language: file.language,
        content: file.code,
        ownerCollaboratorId: writeOwnerCollaboratorId,
        source: 'chat-generated'
      });
    },
    createWorkspaceReferenceDoc: (doc) => {
      const projectId = doc.projectId.trim();
      const title = doc.title.trim();
      if (!projectId || !title) return null;

      const projectExists = getLatestCollectionState().roomProjects.some((project) => project.id === projectId);
      if (!projectExists) return null;

      return collection.createWorkspaceReferenceDoc?.({
        ...doc,
        projectId,
        title,
        ownerCollaboratorId: writeOwnerCollaboratorId,
        source: 'chat-generated'
      }) ?? null;
    },
    promoteCardToProject: ({ cardId, projectTitle, filePath, fileRole }) => {
      const promoted = collection.promoteCardToProject({
        cardId,
        projectTitle,
        filePath,
        fileRole
      });
      if (promoted) {
        const conversation = chat.findConversation(conversationId);
        if (conversation && !conversation.activeProjectId) {
          enterConversationWorkspaceScope({
            conversationId,
            projectId: promoted.projectId,
            setConversationActiveProject: chat.setConversationActiveProject
          });
        }
      }
      return promoted;
    },
    patchCodeCard: (cardId, patch) => {
      const exists = getLatestCollectionState().cards.some((card) => card.id === cardId);
      if (!exists) return false;
      collection.updateCard(cardId, patch);
      return true;
    },
    patchProjectFile: (fileId, patch) => {
      const exists = getLatestCollectionState().projectFiles.some((file) => file.id === fileId);
      if (!exists) return false;
      collection.updateProjectFile(fileId, patch);
      return true;
    },
    deleteProjectFile: (fileId) => {
      const exists = getLatestCollectionState().projectFiles.some((file) => file.id === fileId);
      if (!exists) return false;
      collection.deleteProjectFile(fileId);
      return true;
    },
    selectCodeCard: space.setActiveCard,
    spotlightCodeCard: space.spotlightCard,
    readCodeCard: (cardId) => accessibleCards.find((card) => card.id === cardId) ?? null,
    readProjectFile: (fileId) =>
      filterProjectFilesForCollaboratorScope(
        getLatestCollectionState().projectFiles,
        ownerCollaboratorId,
        activeProjectId
      ).find((file) => file.id === fileId) ?? null,
    listWorkspaceReferenceDocs: (projectId) =>
      (getLatestCollectionState().workspaceReferenceDocs ?? [])
        .filter((doc) => doc.projectId === projectId)
        .filter((doc) =>
          !ownerCollaboratorId
          || !doc.ownerCollaboratorId
          || doc.ownerCollaboratorId === ownerCollaboratorId
        ),
    readWorkspaceReferenceDoc: (docId) =>
      (getLatestCollectionState().workspaceReferenceDocs ?? [])
        .filter((doc) =>
          !ownerCollaboratorId
          || !doc.ownerCollaboratorId
          || doc.ownerCollaboratorId === ownerCollaboratorId
        )
        .find((doc) => doc.id === docId) ?? null,
    readWorkspaceReferenceDocContent,
    deleteWorkspaceReferenceDoc: (docId) => {
      const exists = (getLatestCollectionState().workspaceReferenceDocs ?? []).some((doc) => doc.id === docId);
      if (!exists) return false;
      collection.deleteWorkspaceReferenceDoc?.(docId);
      return true;
    }
  };
}
