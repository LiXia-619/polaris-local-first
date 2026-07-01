import { useEffect, useMemo, useState } from 'react';
import { inferCodeLanguage, normalizeCodeCardTags, normalizeCodeLanguage } from '../../engines/codeCardEngine';
import { filterCodeCardsForCollaboratorScope } from '../../engines/collectionOwnership';
import { enterChatWorld } from '../shell/frontstageNavigation';
import { buildRoomProjectPreview } from '../../engines/roomProjectPreview';
import { normalizeCodeCardFilePath, resolveRoomProjectFiles } from '../../engines/roomProjects';
import { buildCollectionFileCards } from './collectionFileCards';
import { buildCodeCardRunPreview, type CodeCardRunPreview } from './codeCardRunPreview';
import {
  buildNextWorkspaceFilePath,
  buildNextWorkspaceTitle,
  inferManualProjectFileRole
} from './projectWorkspaceCreation';
import { resolveDefaultCollaboratorId } from '../chat/chatConversationSession';
import { describeWorkspaceEditorInvariantViolation } from './workspaceEditorInvariant';
import {
  closeCollectionWorkspaceFileView,
  closeCollectionWorkspaceView,
  resolvePendingWorkspaceCollectionOpen
} from '../shell/workspaceNavigation';
import {
  inspectDesktopProjectChanges,
  syncDesktopProjectFromDisk,
  syncDesktopProjectToDisk,
  type DesktopWorkspaceSyncConfirmationRequest
} from '../desktop/desktopWorkspaceSyncActions';
import {
  buildLocalizedDesktopSyncConfirmationMessage,
  describeLocalizedDesktopChangeStatus,
  describeLocalizedDesktopSyncResult
} from '../desktop/desktopWorkspaceSyncLocalization';
import {
  getDesktopLocalHostBridge,
  type DesktopLocalCommandResult,
  type DesktopLocalCommandSession
} from '../../desktop/localHost';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePersonaStore } from '../../stores/personaStore';
import { useSpaceFrontstageBindings } from '../../stores/spaceStoreFrontstageBindings';
import type { CodeCard, ProjectFile, RoomProject, WorkspaceReferenceDoc, WorkspaceViewReturnTarget } from '../../types/domain';
import { UNCATEGORIZED_CODE_TAG_FILTER, resolveRoomScopedTags, type CodeTagFilter } from './codeCollectionFilterModel';
import { useCodeCollectionChatBridge } from './useCodeCollectionChatBridge';
import { useCodeCollectionFilters } from './useCodeCollectionFilters';
import { useI18n } from '../../i18n';

export type CodeCardSaveResult = {
  cardId: string;
  created: boolean;
};

export type DesktopCommandSessionView = DesktopLocalCommandSession & {
  projectId?: string;
};

function splitDesktopCommandArgs(value: string) {
  return value
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function useCodeCollectionWorkspaceController(args: {
  searchTerm: string;
  onWorkshopOpenChange: (open: boolean) => void;
}) {
  const { searchTerm, onWorkshopOpenChange } = args;
  const { t } = useI18n();
  const frontstage = useSpaceFrontstageBindings();
  const cards = useCollectionStore((state) => state.cards);
  const projectFiles = useCollectionStore((state) => state.projectFiles);
  const workspaceReferenceDocs = useCollectionStore((state) => state.workspaceReferenceDocs);
  const roomProjects = useCollectionStore((state) => state.roomProjects);
  const createCard = useCollectionStore((state) => state.createCard);
  const createProjectFile = useCollectionStore((state) => state.createProjectFile);
  const createWorkspaceReferenceDoc = useCollectionStore((state) => state.createWorkspaceReferenceDoc);
  const createProject = useCollectionStore((state) => state.createProject);
  const promoteStoredCardToProject = useCollectionStore((state) => state.promoteCardToProject);
  const updateProject = useCollectionStore((state) => state.updateProject);
  const toggleProjectPinned = useCollectionStore((state) => state.toggleProjectPinned);
  const deleteProject = useCollectionStore((state) => state.deleteProject);
  const updateCard = useCollectionStore((state) => state.updateCard);
  const toggleCardPinned = useCollectionStore((state) => state.toggleCardPinned);
  const updateProjectFile = useCollectionStore((state) => state.updateProjectFile);
  const updateWorkspaceReferenceDoc = useCollectionStore((state) => state.updateWorkspaceReferenceDoc);
  const deleteCard = useCollectionStore((state) => state.deleteCard);
  const deleteProjectFile = useCollectionStore((state) => state.deleteProjectFile);
  const deleteWorkspaceReferenceDoc = useCollectionStore((state) => state.deleteWorkspaceReferenceDoc);
  const activeCardId = frontstage.activeCardId;
  const setActiveCard = frontstage.setActiveCard;
  const spotlightCardId = frontstage.spotlightCardId;
  const clearSpotlightCard = frontstage.clearSpotlightCard;
  const pendingProjectOpenId = frontstage.pendingProjectOpenId;
  const pendingProjectOpenSource = frontstage.pendingProjectOpenSource;
  const setPendingProjectOpenId = frontstage.setPendingProjectOpenId;
  const setPendingProjectOpenSource = frontstage.setPendingProjectOpenSource;
  const activeProjectId = frontstage.collectionProjectId;
  const setActiveProjectId = frontstage.setCollectionProjectId;

  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const setConversationActiveProject = useChatStore((state) => state.setConversationActiveProject);
  const setInputDraft = useChatStore((state) => state.setInputDraft);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const setPendingCardReference = frontstage.setPendingCardReference;
  const createConversation = useChatStore((state) => state.createConversation);
  const collaborators = usePersonaStore((state) => state.personas);
  const activeCollaboratorId = usePersonaStore((state) => state.activeCollaboratorId);

  const [workshopMode, setWorkshopMode] = useState<'create' | 'edit' | null>(null);
  const [activeProjectFileId, setActiveProjectFileId] = useState<string | null>(null);
  const [projectReturnTarget, setProjectReturnTarget] = useState<WorkspaceViewReturnTarget>(null);
  const [previewState, setPreviewState] = useState<CodeCardRunPreview | null>(null);
  const [desktopSyncBusyProjectId, setDesktopSyncBusyProjectId] = useState<string | null>(null);
  const [desktopSyncStatus, setDesktopSyncStatus] = useState<{
    projectId: string;
    message: string;
    tone?: 'neutral' | 'warning';
  } | null>(null);
  const [desktopCommand, setDesktopCommand] = useState('npm');
  const [desktopCommandArgs, setDesktopCommandArgs] = useState('test');
  const [desktopCommandBusyProjectId, setDesktopCommandBusyProjectId] = useState<string | null>(null);
  const [desktopCommandResult, setDesktopCommandResult] = useState<{
    projectId: string;
    result: DesktopLocalCommandResult | null;
    error: string | null;
  } | null>(null);
  const [desktopCommandSessions, setDesktopCommandSessions] = useState<DesktopCommandSessionView[]>([]);
  const desktopCommandProjectBySessionId = useMemo(() => new Map<string, string>(), []);

  useEffect(() => {
    onWorkshopOpenChange(Boolean(workshopMode));
  }, [onWorkshopOpenChange, workshopMode]);

  const collaboratorScopeId = frontstage.frontstageCollaboratorId;
  const isAggregateScope = collaboratorScopeId === null;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const closeWorkshop = () => {
    setWorkshopMode(null);
    if (!activeProjectFileId) return;
    const targetFile = scopedProjectFiles.find((file) => file.id === activeProjectFileId) ?? null;
    setActiveProjectFileId(null);
    if (!targetFile) return;
    closeCollectionWorkspaceFileView({
      projectId: targetFile.projectId,
      returnTarget: projectReturnTarget,
      setCollectionProjectId: setActiveProjectId,
      setActiveConversation,
      setWorld: frontstage.setWorld
    });
    if (projectReturnTarget?.world === 'chat') {
      setProjectReturnTarget(null);
    }
  };
  const resolvedCollaboratorId = collaboratorScopeId ?? undefined;
  const scopedCards = useMemo(
    () => filterCodeCardsForCollaboratorScope(cards, conversations, collaboratorScopeId),
    [cards, collaboratorScopeId, conversations]
  );

  useEffect(() => {
    if (isAggregateScope && workshopMode === 'create') {
      closeWorkshop();
    }
  }, [isAggregateScope, workshopMode]);

  useEffect(() => {
    if (!activeProjectId) return;
    if (roomProjects.some((project) => project.id === activeProjectId)) return;
    setActiveProjectId(null);
  }, [activeProjectId, roomProjects]);

  useEffect(() => {
    const pendingOpen = resolvePendingWorkspaceCollectionOpen({
      pendingProjectOpenId,
      pendingProjectOpenSource,
      hasWorkspace: (projectId) => roomProjects.some((project) => project.id === projectId)
    });
    if (!pendingOpen) return;
    if (pendingOpen.kind === 'stale') {
      setPendingProjectOpenId(null);
      setPendingProjectOpenSource(null);
      return;
    }
    setActiveProjectFileId(null);
    clearSpotlightCard();
    setActiveCard(null);
    closeWorkshop();
    setActiveProjectId(pendingOpen.projectId);
    setProjectReturnTarget(pendingOpen.returnTarget);
    setPendingProjectOpenId(null);
    setPendingProjectOpenSource(null);
  }, [
    clearSpotlightCard,
    closeWorkshop,
    pendingProjectOpenId,
    pendingProjectOpenSource,
    roomProjects,
    setActiveCard,
    setPendingProjectOpenId,
    setPendingProjectOpenSource
  ]);

  const scopedProjectFiles = useMemo(
    () => (
      collaboratorScopeId
        ? projectFiles.filter((file) => file.ownerCollaboratorId === collaboratorScopeId)
        : projectFiles
    ),
    [collaboratorScopeId, projectFiles]
  );
  const scopedWorkspaceReferenceDocs = useMemo(
    () => (
      collaboratorScopeId
        ? workspaceReferenceDocs.filter((doc) => doc.ownerCollaboratorId === collaboratorScopeId)
        : workspaceReferenceDocs
    ),
    [collaboratorScopeId, workspaceReferenceDocs]
  );

  useEffect(() => {
    if (!activeProjectFileId) return;
    if (scopedProjectFiles.some((file) => file.id === activeProjectFileId)) return;
    setActiveProjectFileId(null);
  }, [activeProjectFileId, scopedProjectFiles]);
  const fileCards = useMemo(
    () => buildCollectionFileCards({
      conversations,
      collaboratorScopeId,
      searchTerm
    }),
    [collaboratorScopeId, conversations, searchTerm]
  );
  const { filteredCards, tagFilter, tagOptions, setTagFilter } = useCodeCollectionFilters({
    cards,
    conversations,
    collaboratorScopeId,
    availableTags: [],
    searchTerm
  });
  const visibleRoomProjects = useMemo(() => {
    const scopedProjectIds = new Set<string>();
    scopedProjectFiles.forEach((file) => scopedProjectIds.add(file.projectId));
    const searchedProjectIds = new Set<string>();
    scopedProjectFiles.forEach((file) => {
      if (!normalizedSearch) return;
      if (file.filePath.toLowerCase().includes(normalizedSearch)) {
        searchedProjectIds.add(file.projectId);
      }
    });

    return roomProjects.filter((project) => {
      const matchesScope = collaboratorScopeId
        ? project.ownerCollaboratorId === collaboratorScopeId || scopedProjectIds.has(project.id)
        : true;
      if (!matchesScope) return false;
      if (!normalizedSearch) return true;
      return project.title.toLowerCase().includes(normalizedSearch) || searchedProjectIds.has(project.id);
    });
  }, [collaboratorScopeId, normalizedSearch, roomProjects, scopedProjectFiles]);
  useEffect(() => {
    if (!activeProjectId) return;
    if (visibleRoomProjects.some((project) => project.id === activeProjectId)) return;
    setActiveProjectId(null);
  }, [activeProjectId, setActiveProjectId, visibleRoomProjects]);
  const hasStandaloneCards = useMemo(
    () => scopedCards.length > 0,
    [scopedCards]
  );
  const standaloneCards = useMemo(
    () => filteredCards,
    [filteredCards]
  );
  const activeRoomTag = null;
  const roomTags = useMemo(
    () => tagOptions
      .map((option) => option.id)
      .filter((tag) => tag !== UNCATEGORIZED_CODE_TAG_FILTER && tag !== 'all'),
    [tagOptions]
  );
  const {
    activeCard,
    activeCardOriginLabel,
    activeCardSourceContext,
    resolveOriginCopy,
    openChat,
    openSourceContext,
    promptChatCard,
    promptChatFromSource
  } = useCodeCollectionChatBridge({
    cards,
    activeCardId,
    conversations,
    collaborators,
    activeConversationId,
    createConversation,
    setActiveConversation,
    setFocusedMessageTarget: frontstage.setFocusedMessageTarget,
    clearPendingAttachments: frontstage.clearPendingAttachments,
    setInputDraft,
    setPendingCardReference,
    setActiveCard,
    setWorld: frontstage.setWorld,
    onCloseWorkshop: closeWorkshop
  });
  const saveCard = (seed: Partial<CodeCard>, editingCardId?: string | null) => {
    const editingProjectFile = editingCardId
      ? scopedProjectFiles.find((file) => file.id === editingCardId) ?? null
      : null;
    if (editingProjectFile) {
      updateProjectFile(editingProjectFile.id, {
        language: seed.language ?? editingProjectFile.language,
        content: seed.code ?? editingProjectFile.content
      });
      return { cardId: editingProjectFile.id, created: false } satisfies CodeCardSaveResult;
    }
    if (editingCardId) {
      updateCard(editingCardId, seed);
      return { cardId: editingCardId, created: false } satisfies CodeCardSaveResult;
    }
    if (!resolvedCollaboratorId) {
      closeWorkshop();
      return { cardId: '', created: false } satisfies CodeCardSaveResult;
    }

    const nextTags = tagFilter === 'all' || tagFilter === UNCATEGORIZED_CODE_TAG_FILTER
      ? seed.tags
      : normalizeCodeCardTags([...(seed.tags ?? []), tagFilter]);
    const cardId = createCard({
      ...seed,
      tags: nextTags,
      ownerCollaboratorId: seed.ownerCollaboratorId ?? resolvedCollaboratorId
    });
    setActiveCard(cardId);
    closeWorkshop();
    return { cardId, created: true } satisfies CodeCardSaveResult;
  };

  const openEditableItem = (itemId: string) => {
    const projectFile = scopedProjectFiles.find((file) => file.id === itemId) ?? null;
    if (projectFile) {
      setActiveProjectId(projectFile.projectId);
      setActiveProjectFileId(projectFile.id);
      clearSpotlightCard(itemId);
      setActiveCard(null);
      setWorkshopMode('edit');
      return;
    }

    setActiveProjectFileId(null);
    setActiveProjectId(null);
    clearSpotlightCard(itemId);
    setActiveCard(itemId);
    setWorkshopMode('edit');
  };

  const openProjectFileEditor = (fileId: string) => {
    const projectFile = scopedProjectFiles.find((file) => file.id === fileId) ?? null;
    if (!projectFile) return;

    setActiveProjectId(projectFile.projectId);
    setActiveProjectFileId(projectFile.id);
    clearSpotlightCard(fileId);
    setActiveCard(null);
    setWorkshopMode('edit');
  };

  const openCreate = () => {
    if (isAggregateScope) return;
    setActiveProjectFileId(null);
    setActiveProjectId(null);
    setActiveCard(null);
    setWorkshopMode('create');
  };

  const removeEditableItem = (itemId: string) => {
    const projectFile = scopedProjectFiles.find((file) => file.id === itemId) ?? null;
    if (projectFile) {
      deleteProjectFile(itemId);
      if (activeProjectFileId === itemId) {
        setActiveProjectFileId(null);
        closeWorkshop();
      }
      return;
    }

    deleteCard(itemId);
    if (activeCardId === itemId) {
      setActiveCard(null);
      closeWorkshop();
    }
  };

  const runCard = (card: CodeCard) => {
    clearSpotlightCard(card.id);
    setActiveProjectFileId(null);
    setActiveProjectId(null);
    setActiveCard(card.id);
    setPreviewState(buildCodeCardRunPreview(card));
  };

  const runDraft = (seed: Partial<CodeCard>) => {
    clearSpotlightCard(activeCard?.id);
    setPreviewState(buildCodeCardRunPreview(seed));
  };

  const activeProject = useMemo(
    () => visibleRoomProjects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, visibleRoomProjects]
  );
  const activeProjectFiles = useMemo(
    () => (activeProject ? resolveRoomProjectFiles(activeProject, scopedProjectFiles) : []),
    [activeProject, scopedProjectFiles]
  );
  const activeProjectConversations = useMemo(
    () => activeProject
      ? conversations.filter((conversation) => (conversation.activeProjectId ?? null) === activeProject.id)
      : [],
    [activeProject, conversations]
  );

  const openProject = (projectId: string) => {
    setActiveProjectFileId(null);
    clearSpotlightCard();
    setActiveCard(null);
    closeWorkshop();
    setProjectReturnTarget(null);
    setActiveProjectId(projectId);
  };

  const openProjectConversation = (projectId: string) => {
    const project = roomProjects.find((candidate) => candidate.id === projectId);
    if (!project) return null;

    const collaboratorId = resolveDefaultCollaboratorId(
      collaborators,
      project.ownerCollaboratorId ?? resolvedCollaboratorId ?? activeCollaboratorId
    );
    if (!collaboratorId) return null;

    const conversationId = createConversation(collaboratorId, {
      activeProjectId: project.id
    });
    frontstage.clearPendingAttachments();
    frontstage.clearPendingCardReference();
    setActiveConversation(conversationId);
    setActiveProjectFileId(null);
    setProjectReturnTarget(null);
    setActiveProjectId(null);
    enterChatWorld(frontstage);
    return conversationId;
  };

  const openExistingProjectConversation = (conversationId: string) => {
    const conversation = conversations.find((candidate) => candidate.id === conversationId) ?? null;
    if (!conversation?.activeProjectId) return;

    frontstage.clearPendingAttachments();
    frontstage.clearPendingCardReference();
    setActiveConversation(conversation.id);
    setActiveProjectFileId(null);
    setProjectReturnTarget(null);
    setActiveProjectId(null);
    enterChatWorld(frontstage);
  };

  const removeProjectConversation = (conversationId: string) => {
    deleteConversation(conversationId);
  };

  const createWorkspaceProject = () => {
    if (!resolvedCollaboratorId) return null;

    const title = buildNextWorkspaceTitle(
      roomProjects
        .filter((project) => project.ownerCollaboratorId === resolvedCollaboratorId)
        .map((project) => project.title)
    );
    const projectId = createProject({
      title,
      ownerCollaboratorId: resolvedCollaboratorId,
      source: 'manual'
    });

    setActiveProjectFileId(null);
    setWorkshopMode(null);
    clearSpotlightCard();
    setActiveCard(null);
    setProjectReturnTarget(null);
    setActiveProjectId(projectId);
    return projectId;
  };

  const createProjectFileInWorkspace = (args: {
    projectId: string;
    filePath: string;
    content?: string;
    language?: string;
    openEditor?: boolean;
  }) => {
    const project = roomProjects.find((candidate) => candidate.id === args.projectId) ?? null;
    const normalizedPath = normalizeCodeCardFilePath(args.filePath);
    if (!project || !normalizedPath) return null;

    const uniquePath = buildNextWorkspaceFilePath(
      projectFiles
        .filter((file) => file.projectId === args.projectId)
        .map((file) => file.filePath),
      normalizedPath
    );
    const content = args.content ?? '';
    const inferredLanguage = normalizeCodeLanguage(
      args.language ?? inferCodeLanguage(content, uniquePath.split('.').pop())
    );
    const fileId = createProjectFile({
      projectId: args.projectId,
      filePath: uniquePath,
      fileRole: inferManualProjectFileRole(uniquePath, inferredLanguage),
      language: inferredLanguage,
      content,
      ownerCollaboratorId: project.ownerCollaboratorId ?? resolvedCollaboratorId,
      source: 'manual'
    });
    if (!fileId) return null;

    setActiveProjectId(args.projectId);
    if (args.openEditor ?? true) {
      setActiveProjectFileId(fileId);
      clearSpotlightCard(fileId);
      setActiveCard(null);
      setWorkshopMode('edit');
    }
    return fileId;
  };

  const createWorkspaceReferenceInProject = (args: {
    projectId: string;
    title: string;
    summary?: string;
    content?: string;
  }) => {
    const project = roomProjects.find((candidate) => candidate.id === args.projectId) ?? null;
    const title = args.title.trim();
    if (!project || !title) return null;
    return createWorkspaceReferenceDoc({
      projectId: args.projectId,
      title,
      summary: args.summary,
      content: args.content ?? '',
      ownerCollaboratorId: project.ownerCollaboratorId ?? resolvedCollaboratorId,
      source: 'manual'
    });
  };

  const importWorkspaceReferenceToProject = (args: {
    projectId: string;
    title: string;
    summary: string;
    content: string;
  }) => {
    const project = roomProjects.find((candidate) => candidate.id === args.projectId) ?? null;
    if (!project) return null;
    return createWorkspaceReferenceDoc({
      projectId: args.projectId,
      title: args.title,
      summary: args.summary,
      content: args.content,
      ownerCollaboratorId: project.ownerCollaboratorId ?? resolvedCollaboratorId,
      source: 'imported'
    });
  };

  const updateWorkspaceReference = (
    docId: string,
    patch: Partial<Pick<WorkspaceReferenceDoc, 'title' | 'summary' | 'content'>>
  ) => {
    updateWorkspaceReferenceDoc(docId, patch);
  };

  const promoteCardToProject = (cardId: string) => {
    const card = cards.find((candidate) => candidate.id === cardId);
    if (!card) return null;
    const result = promoteStoredCardToProject({ cardId });
    if (!result) return null;
    if (activeCardId === card.id) {
      setActiveCard(null);
      closeWorkshop();
    }
    openProject(result.projectId);
    return result.projectId;
  };

  const closeProject = () => {
    setActiveProjectFileId(null);
    const returnTarget = projectReturnTarget;
    setProjectReturnTarget(null);
    closeCollectionWorkspaceView({
      returnTarget,
      setCollectionProjectId: setActiveProjectId,
      setActiveConversation,
      setWorld: frontstage.setWorld
    });
  };

  const renameProject = (projectId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return false;
    const project = roomProjects.find((candidate) => candidate.id === projectId);
    if (!project || project.title === trimmedTitle) return false;
    updateProject(projectId, { title: trimmedTitle });
    return true;
  };

  const setProjectPreviewStateAccess = (projectId: string, assistantReadEnabled: boolean) => {
    const project = roomProjects.find((candidate) => candidate.id === projectId);
    if (!project) return false;
    updateProject(projectId, {
      previewStateAccess: assistantReadEnabled
        ? {
            assistantReadEnabled: true,
            updatedAt: Date.now()
          }
        : undefined
    });
    return true;
  };

  const removeProject = (projectId: string) => {
    deleteProject(projectId);
    conversations.forEach((conversation) => {
      if (conversation.activeProjectId === projectId) {
        setConversationActiveProject(conversation.id, null);
      }
    });
    if (activeProjectId === projectId) {
      setActiveProjectFileId(null);
      setActiveProjectId(null);
    }
    if (previewState?.projectId === projectId) {
      setPreviewState(null);
    }
  };

  const runProject = (projectId: string) => {
    const project = roomProjects.find((candidate) => candidate.id === projectId);
    if (!project) return;
      const preview = buildRoomProjectPreview(project, scopedProjectFiles);
    if (!preview) return;
    const projectFiles = resolveRoomProjectFiles(project, scopedProjectFiles);
    clearSpotlightCard();
    setPreviewState({
      previewItemId: preview.entryFileId,
      projectId: project.id,
      projectFileCount: projectFiles.length,
      title: project.title,
      srcDoc: preview.srcDoc,
      content: preview.content,
      language: preview.language,
      presentation: preview.presentation
    });
  };

  const confirmDesktopSyncPlan = (request: DesktopWorkspaceSyncConfirmationRequest) => {
    const message = buildLocalizedDesktopSyncConfirmationMessage(request, t);
    return message ? window.confirm(message) : true;
  };

  const syncProjectFromDisk = async (projectId: string) => {
    try {
      setDesktopSyncBusyProjectId(projectId);
      setDesktopSyncStatus(null);
      const result = await syncDesktopProjectFromDisk({
        bridge: getDesktopLocalHostBridge(),
        projectId,
        confirmPlan: confirmDesktopSyncPlan
      });
      setDesktopSyncStatus({
        projectId,
        message: describeLocalizedDesktopSyncResult(result, t),
        tone: result.issueCount > 0 ? 'warning' : 'neutral'
      });
    } catch (error) {
      setDesktopSyncStatus({
        projectId,
        message: error instanceof Error ? error.message : t('settings.desktopLocal.syncFromMacFailed'),
        tone: 'warning'
      });
    } finally {
      setDesktopSyncBusyProjectId(null);
    }
  };

  const syncProjectToDisk = async (projectId: string) => {
    try {
      setDesktopSyncBusyProjectId(projectId);
      setDesktopSyncStatus(null);
      const result = await syncDesktopProjectToDisk({
        bridge: getDesktopLocalHostBridge(),
        projectId,
        confirmPlan: confirmDesktopSyncPlan
      });
      setDesktopSyncStatus({
        projectId,
        message: describeLocalizedDesktopSyncResult(result, t),
        tone: result.issueCount > 0 ? 'warning' : 'neutral'
      });
    } catch (error) {
      setDesktopSyncStatus({
        projectId,
        message: error instanceof Error ? error.message : t('settings.desktopLocal.writeToMacFailed'),
        tone: 'warning'
      });
    } finally {
      setDesktopSyncBusyProjectId(null);
    }
  };

  const inspectProjectChanges = async (projectId: string) => {
    try {
      setDesktopSyncBusyProjectId(projectId);
      setDesktopSyncStatus(null);
      const status = await inspectDesktopProjectChanges({
        bridge: getDesktopLocalHostBridge(),
        projectId
      });
      setDesktopSyncStatus({
        projectId,
        message: describeLocalizedDesktopChangeStatus(status, t),
        tone: status.conflictFiles.length > 0 ? 'warning' : 'neutral'
      });
    } catch (error) {
      setDesktopSyncStatus({
        projectId,
        message: error instanceof Error ? error.message : t('settings.desktopLocal.checkLocalChangesFailed'),
        tone: 'warning'
      });
    } finally {
      setDesktopSyncBusyProjectId(null);
    }
  };

  const resolveDesktopSessionProjectId = (session: DesktopLocalCommandSession) => {
    const rememberedProjectId = desktopCommandProjectBySessionId.get(session.id);
    if (rememberedProjectId) return rememberedProjectId;
    return roomProjects.find((project) => project.desktopBinding?.rootId === session.root.id)?.id;
  };

  const upsertDesktopCommandSession = (session: DesktopLocalCommandSession, projectId?: string) => {
    const resolvedProjectId = projectId ?? resolveDesktopSessionProjectId(session);
    if (resolvedProjectId) {
      desktopCommandProjectBySessionId.set(session.id, resolvedProjectId);
    }
    const nextSession: DesktopCommandSessionView = {
      ...session,
      projectId: resolvedProjectId
    };
    setDesktopCommandSessions((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === session.id);
      if (existingIndex < 0) return [...current, nextSession];
      const next = [...current];
      next[existingIndex] = {
        ...next[existingIndex],
        ...nextSession,
        projectId: nextSession.projectId ?? next[existingIndex].projectId
      };
      return next;
    });
  };

  const runDesktopProjectCommand = async (projectId: string) => {
    const project = roomProjects.find((candidate) => candidate.id === projectId) ?? null;
    const bridge = getDesktopLocalHostBridge();
    if (!project?.desktopBinding || !bridge) {
      setDesktopCommandResult({
        projectId,
        result: null,
        error: t('settings.desktopLocal.commandUnavailable')
      });
      return;
    }
    try {
      setDesktopCommandBusyProjectId(projectId);
      setDesktopCommandResult(null);
      if (bridge.startCommand) {
        const session = await bridge.startCommand({
          rootId: project.desktopBinding.rootId,
          command: desktopCommand.trim(),
          args: splitDesktopCommandArgs(desktopCommandArgs)
        });
        upsertDesktopCommandSession(session, projectId);
        return;
      }
      const result = await bridge.runCommand({
        rootId: project.desktopBinding.rootId,
        command: desktopCommand.trim(),
        args: splitDesktopCommandArgs(desktopCommandArgs)
      });
      setDesktopCommandResult({
        projectId,
        result,
        error: null
      });
    } catch (error) {
      setDesktopCommandResult({
        projectId,
        result: null,
        error: error instanceof Error ? error.message : t('settings.desktopLocal.commandRunFailed')
      });
    } finally {
      setDesktopCommandBusyProjectId(null);
    }
  };

  const stopDesktopProjectCommand = async (sessionId: string) => {
    const bridge = getDesktopLocalHostBridge();
    if (!bridge?.stopCommand) return;
    try {
      const session = await bridge.stopCommand({ sessionId });
      upsertDesktopCommandSession(session);
    } catch (error) {
      setDesktopCommandResult({
        projectId: desktopCommandProjectBySessionId.get(sessionId) ?? activeProjectId ?? '',
        result: null,
        error: error instanceof Error ? error.message : t('settings.desktopLocal.commandStopFailed')
      });
    }
  };

  const activeProjectFile = useMemo(
    () => (activeProjectFileId ? scopedProjectFiles.find((file) => file.id === activeProjectFileId) ?? null : null),
    [activeProjectFileId, scopedProjectFiles]
  );
  const activeProjectReferenceDocs = useMemo(
    () => activeProjectId
      ? scopedWorkspaceReferenceDocs.filter((doc) => doc.projectId === activeProjectId)
      : [],
    [activeProjectId, scopedWorkspaceReferenceDocs]
  );

  useEffect(() => {
    if (!activeProject?.desktopBinding) return;
    const bridge = getDesktopLocalHostBridge();
    if (!bridge) return;
    let cancelled = false;

    const inspectWhenTrusted = async () => {
      const hostState = await bridge.getState().catch(() => null);
      if (cancelled || hostState?.permissionMode !== 'trusted') return;
      void inspectProjectChanges(activeProject.id);
    };

    void inspectWhenTrusted();

    return () => {
      cancelled = true;
    };
  }, [activeProject?.desktopBinding?.rootId, activeProject?.desktopBinding?.syncedAt, activeProject?.id]);

  useEffect(() => {
    const bridge = getDesktopLocalHostBridge();
    if (!bridge) return;
    let cancelled = false;

    if (bridge.listCommandSessions) {
      bridge.listCommandSessions()
        .then((sessions) => {
          if (cancelled) return;
          sessions.forEach((session) => upsertDesktopCommandSession(session));
        })
        .catch(() => undefined);
    }

    const unsubscribe = bridge.onCommandSession?.((event) => {
      upsertDesktopCommandSession(event.session);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [desktopCommandProjectBySessionId, roomProjects]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const violation = describeWorkspaceEditorInvariantViolation({
      workshopMode,
      activeCardId,
      activeProjectFileId,
      hasActiveCard: Boolean(activeCard),
      hasActiveProjectFile: Boolean(activeProjectFile)
    });
    if (!violation) return;

    console.error('[collection:workspace-editor]', violation, {
      workshopMode,
      activeCardId,
      activeProjectFileId
    });
  }, [
    activeCard,
    activeCardId,
    activeProjectFile,
    activeProjectFileId,
    workshopMode
  ]);

  const openFileSource = (fileCard: { conversationId: string; messageId: string }) => {
    if (fileCard.conversationId !== activeConversationId) {
      frontstage.clearPendingAttachments();
      frontstage.clearPendingCardReference();
    }
    setActiveConversation(fileCard.conversationId);
    frontstage.setFocusedMessageTarget({
      conversationId: fileCard.conversationId,
      messageId: fileCard.messageId
    });
    enterChatWorld(frontstage);
    closeWorkshop();
  };

  return {
    cards,
    standaloneCards,
    projectFiles,
    workspaceReferenceDocs: scopedWorkspaceReferenceDocs,
    roomProjects: visibleRoomProjects,
    activeProject,
    activeProjectFiles,
    activeProjectReferenceDocs,
    activeProjectConversations,
    desktopSyncBusyProjectId,
    desktopSyncStatus,
    desktopCommand,
    desktopCommandArgs,
    desktopCommandBusyProjectId,
    desktopCommandResult,
    desktopCommandSessions,
    fileCards,
    collaborators,
    activeConversationId,
    activeCardId,
    spotlightCardId,
    workshopMode,
    previewState,
    isAggregateScope,
    roomTags,
    activeRoomTag,
    tagFilter,
    tagOptions,
    filteredCards,
    hasStandaloneCards: isAggregateScope ? cards.some((card) => card.kind !== 'room-rule') : hasStandaloneCards,
    activeCard,
    activeProjectFile,
    activeCardOriginLabel,
    activeCardSourceContext,
    resolveOriginCopy,
    setTagFilter,
    updateCard,
    toggleCardPinned,
    updateProjectFile,
    toggleProjectPinned,
    closeWorkshop,
    saveCard,
    openEditableItem,
    openProjectFileEditor,
    openCreate,
    openProject,
    openProjectConversation,
    openExistingProjectConversation,
    removeProjectConversation,
    createWorkspaceProject,
    createProjectFileInWorkspace,
    createWorkspaceReferenceInProject,
    importWorkspaceReferenceToProject,
    updateWorkspaceReference,
    deleteWorkspaceReferenceDoc,
    promoteCardToProject,
    closeProject,
    renameProject,
    setProjectPreviewStateAccess,
    removeProject,
    openChat,
    openSourceContext,
    promptChatCard,
    promptChatFromSource,
    removeEditableItem,
    openFileSource,
    runCard,
    runProject,
    inspectProjectChanges,
    syncProjectFromDisk,
    syncProjectToDisk,
    setDesktopCommand,
    setDesktopCommandArgs,
    runDesktopProjectCommand,
    stopDesktopProjectCommand,
    runDraft,
    closePreview: () => setPreviewState(null)
  };
}
