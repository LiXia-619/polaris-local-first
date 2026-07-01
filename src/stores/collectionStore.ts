import { create } from 'zustand';
import type { CodeCard, CodeCardFileRole, Conversation, ImageAssetCard, ProjectFile, RoomProject, WorkspaceReferenceDoc } from '../types/domain';
import { backfillOwnership } from '../engines/collectionOwnership';
import {
  createCardPromotionSnapshot,
  createRoomProject,
  normalizeRoomProject,
  reconcileRoomProjects,
  suggestRoomProjectPlacementForCard,
  sortRoomProjects,
  type RoomProjectPatch
} from '../engines/roomProjects';
import {
  createCodeCardEntry,
  createCodeCardFromChat,
  type CodeCardPatch,
  normalizeCodeCard,
  patchCodeCards,
  removeCodeCard,
  type SaveFromChatInput,
  type SaveFromChatResult,
  sortCodeCards
} from './collectionStoreCodeCards';
import {
  createProjectFileEntry,
  type ProjectFilePatch,
  migrateLegacyProjectCards,
  patchProjectFiles,
  removeProjectFile,
  sortProjectFiles
} from './collectionStoreProjectFiles';
import {
  createWorkspaceReferenceDocEntry,
  normalizeWorkspaceReferenceDoc,
  patchWorkspaceReferenceDocs,
  removeWorkspaceReferenceDoc,
  sortWorkspaceReferenceDocs,
  wouldEraseUnloadedWorkspaceReferenceContent,
  type WorkspaceReferenceDocPatch
} from './collectionStoreWorkspaceReferences';
import {
  createImageCardFromAsset,
  createImageCardFromChat,
  migrateLegacyImageCard,
  normalizeImageCard,
  patchImageCards,
  removeImageCard,
  type CreateImageCardFromAssetInput,
  type ImageCardPatch,
  type SaveImageFromChatInput,
  sortImageCards
} from './collectionStoreImageCards';
import { readCollectionState, writeCollectionState } from './collectionStorePersistence';
import {
  stageWorkspaceReferenceDocContent,
  stageWorkspaceReferenceDocDeletion
} from './workspaceReferenceDocContentPersistence';
import { useChatStore } from './chatStore';
import {
  LEGACY_MISSING_DEFAULT_COLLECTION_CARD_IDS,
  includeDefaultCollectionCards,
  isDefaultCollectionCardId,
  stripRetiredCollectionCards
} from './collectionStarterCard';
import { includeDefaultCollectionProjects } from './collectionStarterProject';
import { repairCollectionProjectTopology } from './collectionStoreProjectTopology';

function stripRoomRuleCards(cards: CodeCard[]) {
  return cards.filter((card) => card.kind !== 'room-rule');
}

export function resolveDeletedBundledCardIdsForPersistedCards(
  cards: CodeCard[],
  deletedBundledCardIds: string[] = []
) {
  const missingBundledCardIds = LEGACY_MISSING_DEFAULT_COLLECTION_CARD_IDS.filter(
    (cardId) => cards.every((card) => card.id !== cardId)
  );
  return Array.from(new Set([
    ...deletedBundledCardIds,
    ...missingBundledCardIds
  ]));
}

type CollectionState = {
  cards: CodeCard[];
  projectFiles: ProjectFile[];
  workspaceReferenceDocs: WorkspaceReferenceDoc[];
  roomProjects: RoomProject[];
  imageCards: ImageAssetCard[];
  deletedBundledCardIds: string[];
  hydrated: boolean;
  createCard: (seed?: Partial<CodeCard>) => string;
  createProjectFile: (seed: Partial<ProjectFile> & Pick<ProjectFile, 'projectId' | 'filePath'>) => string | null;
  createWorkspaceReferenceDoc: (
    seed: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'projectId' | 'title'>
  ) => string | null;
  createProject: (seed?: Partial<RoomProject>) => string;
  promoteCardToProject: (args: {
    cardId: string;
    projectTitle?: string;
    filePath?: string;
    fileRole?: CodeCardFileRole;
  }) => { projectId: string; fileId: string } | null;
  updateProject: (projectId: string, patch: RoomProjectPatch) => void;
  toggleProjectPinned: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  updateCard: (cardId: string, patch: CodeCardPatch) => void;
  toggleCardPinned: (cardId: string) => void;
  updateProjectFile: (fileId: string, patch: ProjectFilePatch) => void;
  updateWorkspaceReferenceDoc: (docId: string, patch: WorkspaceReferenceDocPatch) => void;
  updateImageCard: (cardId: string, patch: ImageCardPatch) => void;
  deleteCard: (cardId: string) => void;
  deleteProjectFile: (fileId: string) => void;
  deleteWorkspaceReferenceDoc: (docId: string) => void;
  deleteImageCard: (cardId: string) => void;
  saveCardFromChat: (input: SaveFromChatInput) => SaveFromChatResult | null;
  createImageCardFromAsset: (input: CreateImageCardFromAssetInput) => SaveFromChatResult | null;
  saveImageCardFromChat: (input: SaveImageFromChatInput) => SaveFromChatResult | null;
  backfillOwnershipFromConversations: (conversations: Conversation[]) => void;
  hydrateFromDb: () => Promise<void>;
  persistToDb: () => Promise<void>;
};

function buildProjectOwnerBackfillMap(conversations: Conversation[]) {
  const ownerByProjectId = new Map<string, string>();
  conversations.forEach((conversation) => {
    const projectId = conversation.activeProjectId?.trim();
    const collaboratorId = conversation.collaboratorId?.trim();
    if (!projectId || !collaboratorId || ownerByProjectId.has(projectId)) return;
    ownerByProjectId.set(projectId, collaboratorId);
  });
  return ownerByProjectId;
}

function backfillProjectOwnershipFromConversations<T extends { ownerCollaboratorId?: string }>(
  items: T[],
  ownerByProjectId: ReadonlyMap<string, string>,
  resolveProjectId: (item: T) => string | undefined
) {
  let changed = false;
  const nextItems = items.map((item) => {
    if (item.ownerCollaboratorId) return item;
    const projectId = resolveProjectId(item)?.trim();
    const ownerCollaboratorId = projectId ? ownerByProjectId.get(projectId) : undefined;
    if (!ownerCollaboratorId) return item;
    changed = true;
    return {
      ...item,
      ownerCollaboratorId
    };
  });
  return changed ? nextItems : items;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  cards: [],
  projectFiles: [],
  workspaceReferenceDocs: [],
  roomProjects: [],
  imageCards: [],
  deletedBundledCardIds: [],
  hydrated: false,

  createCard: (seed) => {
    const nextCard = createCodeCardEntry(seed);

    set((state) => ({
      cards: sortCodeCards([nextCard, ...state.cards]),
      roomProjects: reconcileRoomProjects(state.roomProjects, [nextCard, ...state.cards], state.projectFiles)
    }));

    return nextCard.id;
  },

  createProjectFile: (seed) => {
    const projectId = seed.projectId.trim();
    const projectExists = get().roomProjects.some((project) => project.id === projectId);
    if (!projectExists) return null;

    const nextFile = createProjectFileEntry({ ...seed, projectId });

    set((state) => {
      const projectFiles = sortProjectFiles([nextFile, ...state.projectFiles]);
      return {
        projectFiles,
        roomProjects: reconcileRoomProjects(state.roomProjects, state.cards, projectFiles)
      };
    });

    return nextFile.id;
  },

  createWorkspaceReferenceDoc: (seed) => {
    const projectId = seed.projectId.trim();
    const project = get().roomProjects.find((candidate) => candidate.id === projectId);
    if (!project) return null;

    const nextDoc = createWorkspaceReferenceDocEntry({
      ...seed,
      projectId,
      ownerCollaboratorId: seed.ownerCollaboratorId ?? project.ownerCollaboratorId
    });
    if (nextDoc.content.length > 0) {
      stageWorkspaceReferenceDocContent(nextDoc.id, nextDoc.content);
    }
    const directoryDoc = normalizeWorkspaceReferenceDoc({
      ...nextDoc,
      content: '',
      charCount: nextDoc.content.length,
      contentLoaded: false
    });

    set((state) => ({
      workspaceReferenceDocs: sortWorkspaceReferenceDocs([directoryDoc, ...state.workspaceReferenceDocs])
    }));

    return nextDoc.id;
  },

  createProject: (seed) => {
    const requestedId = typeof seed?.id === 'string' && seed.id.trim() ? seed.id.trim() : null;
    if (requestedId) {
      const existing = get().roomProjects.find((project) => project.id === requestedId);
      if (existing) {
        return existing.id;
      }
    }

    const nextProject = createRoomProject(seed);
    set((state) => ({
      roomProjects: sortRoomProjects([nextProject, ...state.roomProjects])
    }));
    return nextProject.id;
  },

  promoteCardToProject: ({ cardId, projectTitle, filePath, fileRole }) => {
    const card = get().cards.find((candidate) => candidate.id === cardId);
    if (!card || card.kind === 'tool') {
      return null;
    }

    const placement = suggestRoomProjectPlacementForCard(card);
    const nextProject = createRoomProject({
      title: projectTitle?.trim() || card.title,
      ownerCollaboratorId: card.ownerCollaboratorId,
      tags: card.tags,
      coverNote: card.cardNote,
      coverStyle: card.cardFaceCss,
      promotionSnapshot: createCardPromotionSnapshot(card),
      source: card.source,
      pinnedAt: card.pinnedAt
    });
    const nextFile = createProjectFileEntry({
      projectId: nextProject.id,
      filePath: filePath?.trim() || placement.filePath,
      fileRole: fileRole ?? placement.fileRole,
      language: card.language,
      content: card.code,
      ownerCollaboratorId: card.ownerCollaboratorId,
      source: card.source,
      originConversationId: card.originConversationId,
      originMessageId: card.originMessageId,
      originBlockIndex: card.originBlockIndex,
      originBlockTitle: card.originBlockTitle
    });

    set((state) => {
      const cards = removeCodeCard(state.cards, card.id);
      const projectFiles = sortProjectFiles([nextFile, ...state.projectFiles]);
      const roomProjects = reconcileRoomProjects(
        [
          normalizeRoomProject({
            ...nextProject,
            entryFileId: nextFile.id,
            fileIds: [nextFile.id]
          }),
          ...state.roomProjects
        ],
        cards,
        projectFiles
      );

      return {
        cards,
        projectFiles,
        roomProjects
      };
    });

    return {
      projectId: nextProject.id,
      fileId: nextFile.id
    };
  },

  updateProject: (projectId, patch) => {
    set((state) => ({
      roomProjects: reconcileRoomProjects(
        state.roomProjects.map((project) =>
          project.id === projectId
            ? normalizeRoomProject({
                ...project,
                ...patch,
                title: typeof patch.title === 'string' ? patch.title : project.title,
                slug: patch.slug ?? project.slug,
                updatedAt: Date.now()
              })
            : project
        ),
        state.cards,
        state.projectFiles
      )
    }));
  },

  toggleProjectPinned: (projectId) => {
    set((state) => ({
      roomProjects: reconcileRoomProjects(
        state.roomProjects.map((project) =>
          project.id === projectId
            ? normalizeRoomProject({
                ...project,
                pinnedAt: project.pinnedAt ? null : Date.now()
              })
            : project
        ),
        state.cards,
        state.projectFiles
      )
    }));
  },

  updateCard: (cardId, patch) => {
    set((state) => {
      const cards = patchCodeCards(state.cards, cardId, patch);
      return {
        cards,
        roomProjects: reconcileRoomProjects(state.roomProjects, cards, state.projectFiles)
      };
    });
  },

  toggleCardPinned: (cardId) => {
    set((state) => {
      const cards = patchCodeCards(
        state.cards,
        cardId,
        { pinnedAt: state.cards.find((card) => card.id === cardId)?.pinnedAt ? null : Date.now() }
      );
      return {
        cards,
        roomProjects: reconcileRoomProjects(state.roomProjects, cards, state.projectFiles)
      };
    });
  },

  updateProjectFile: (fileId, patch) => {
    set((state) => {
      const projectFiles = patchProjectFiles(state.projectFiles, fileId, patch);
      return {
        projectFiles,
        roomProjects: reconcileRoomProjects(state.roomProjects, state.cards, projectFiles)
      };
    });
  },

  updateWorkspaceReferenceDoc: (docId, patch) => {
    if (patch.content !== undefined) {
      const targetDoc = get().workspaceReferenceDocs.find((doc) => doc.id === docId);
      if (!targetDoc || !wouldEraseUnloadedWorkspaceReferenceContent(targetDoc, patch.content)) {
        stageWorkspaceReferenceDocContent(docId, patch.content);
      }
    }
    set((state) => ({
      workspaceReferenceDocs: patchWorkspaceReferenceDocs(state.workspaceReferenceDocs, docId, {
        ...patch,
        content: patch.content !== undefined ? '' : undefined,
        charCount: patch.content !== undefined ? patch.content.length : undefined,
        contentLoaded: patch.content !== undefined ? false : undefined
      })
    }));
  },

  updateImageCard: (cardId, patch) => {
    set((state) => ({
      imageCards: patchImageCards(state.imageCards, cardId, patch)
    }));
  },

  deleteCard: (cardId) => {
    set((state) => {
      const cards = removeCodeCard(state.cards, cardId);
      const deletedBundledCardIds =
        isDefaultCollectionCardId(cardId) && !state.deletedBundledCardIds.includes(cardId)
          ? [...state.deletedBundledCardIds, cardId]
          : state.deletedBundledCardIds;
      return {
        cards,
        deletedBundledCardIds,
        roomProjects: reconcileRoomProjects(state.roomProjects, cards, state.projectFiles)
      };
    });
  },

  deleteProjectFile: (fileId) => {
    set((state) => {
      const projectFiles = removeProjectFile(state.projectFiles, fileId);
      return {
        projectFiles,
        roomProjects: reconcileRoomProjects(state.roomProjects, state.cards, projectFiles)
      };
    });
  },

  deleteWorkspaceReferenceDoc: (docId) => {
    // Explicit deletion: stage the body deletion so the next persist tombstones the document
    // body row through the explicit channel, rather than relying on the doc being absent from
    // the next save (which must never delete a body — see the workspace body writer).
    stageWorkspaceReferenceDocDeletion(docId);
    set((state) => ({
      workspaceReferenceDocs: removeWorkspaceReferenceDoc(state.workspaceReferenceDocs, docId)
    }));
  },

  deleteProject: (projectId) => {
    set((state) => {
      const projectFiles = state.projectFiles.filter((file) => file.projectId !== projectId);
      // Deleting a project explicitly removes the workspace docs it owns; stage each removed
      // doc's body deletion so the document body rows are tombstoned through the explicit
      // channel, not by the docs merely vanishing from the next persist's list.
      for (const doc of state.workspaceReferenceDocs) {
        if (doc.projectId === projectId) stageWorkspaceReferenceDocDeletion(doc.id);
      }
      const workspaceReferenceDocs = state.workspaceReferenceDocs.filter((doc) => doc.projectId !== projectId);

      return {
        projectFiles,
        workspaceReferenceDocs,
        roomProjects: reconcileRoomProjects(
          state.roomProjects.filter((project) => project.id !== projectId),
          state.cards,
          projectFiles
        )
      };
    });
    useChatStore.getState().reconcileConversationWorkspaceBindings(
      get().roomProjects.map((project) => project.id)
    );
  },

  deleteImageCard: (cardId) => {
    set((state) => ({
      imageCards: removeImageCard(state.imageCards, cardId)
    }));
  },

  saveCardFromChat: (input) => {
    const existing = get().cards.find(
      (card) =>
        card.originConversationId === input.conversationId &&
        card.originMessageId === input.messageId &&
        (card.originBlockIndex ?? 0) === input.blockIndex
    );

    if (existing) {
      return {
        cardId: existing.id,
        created: false,
        title: existing.title
      };
    }

    const nextCard = createCodeCardFromChat({
      ...input
    });

    set((state) => ({
      cards: sortCodeCards([nextCard, ...state.cards]),
      roomProjects: reconcileRoomProjects(state.roomProjects, [nextCard, ...state.cards], state.projectFiles)
    }));

    return {
      cardId: nextCard.id,
      created: true,
      title: nextCard.title
    };
  },

  createImageCardFromAsset: (input) => {
    if (!input.assetId.trim()) return null;

    const existing = get().imageCards.find((card) => card.assetId === input.assetId);
    if (existing) {
      set((state) => ({
        imageCards: sortImageCards(
          state.imageCards.map((card) =>
            card.id === existing.id
              ? {
                  ...card,
                  updatedAt: Date.now()
                }
              : card
          )
        )
      }));
      return {
        cardId: existing.id,
        created: false,
        title: existing.title
      };
    }

    const nextCard = createImageCardFromAsset(input);

    set((state) => ({
      imageCards: sortImageCards([nextCard, ...state.imageCards])
    }));

    return {
      cardId: nextCard.id,
      created: true,
      title: nextCard.title
    };
  },

  saveImageCardFromChat: (input) => {
    const existing = get().imageCards.find(
      (card) =>
        card.originConversationId === input.conversationId &&
        card.originMessageId === input.messageId &&
        card.originAttachmentId === input.attachmentId
    );

    if (existing) {
      set((state) => ({
        imageCards: sortImageCards(
          state.imageCards.map((card) =>
            card.id === existing.id
              ? {
                  ...card,
                  updatedAt: Date.now()
                }
              : card
          )
        )
      }));
      return {
        cardId: existing.id,
        created: false,
        title: existing.title
      };
    }

    const nextCard = createImageCardFromChat(input);

    set((state) => ({
      imageCards: sortImageCards([nextCard, ...state.imageCards])
    }));

    return {
      cardId: nextCard.id,
      created: true,
      title: nextCard.title
    };
  },

  backfillOwnershipFromConversations: (conversations) => {
    set((state) => {
      const ownerByProjectId = buildProjectOwnerBackfillMap(conversations);
      const cards = backfillOwnership(state.cards, conversations);
      const imageCards = backfillOwnership(state.imageCards, conversations);
      const projectFiles = backfillProjectOwnershipFromConversations(
        state.projectFiles,
        ownerByProjectId,
        (file) => file.projectId
      );
      const ownedRoomProjects = backfillProjectOwnershipFromConversations(
        state.roomProjects,
        ownerByProjectId,
        (project) => project.id
      );
      const roomProjects = reconcileRoomProjects(ownedRoomProjects, cards, projectFiles);
      if (
        cards === state.cards
        && imageCards === state.imageCards
        && projectFiles === state.projectFiles
        && roomProjects === state.roomProjects
      ) {
        return state;
      }
      return {
        cards,
        projectFiles,
        roomProjects,
        imageCards
      };
    });
  },

  hydrateFromDb: async () => {
    let payload: Awaited<ReturnType<typeof readCollectionState>>;
    try {
      payload = await readCollectionState({ throwOnReadFailure: true });
    } catch {
      return;
    }
    if (payload) {
      const migrated = migrateLegacyProjectCards({
        projectFiles: payload.projectFiles,
        cards: payload.cards
      });
      const persistedCards = sortCodeCards(stripRetiredCollectionCards(
        stripRoomRuleCards(migrated.cards.map((card) => normalizeCodeCard(card)))
      ));
      const deletedBundledCardIds = resolveDeletedBundledCardIdsForPersistedCards(
        persistedCards,
        payload.deletedBundledCardIds ?? []
      );
      const cards = includeDefaultCollectionCards(
        persistedCards,
        Date.now(),
        { deletedBundledCardIds }
      );
      const repairedTopology = repairCollectionProjectTopology({
        roomProjects: payload.roomProjects,
        projectFiles: migrated.projectFiles,
        workspaceReferenceDocs: payload.workspaceReferenceDocs
      });
      const defaults = includeDefaultCollectionProjects(
        repairedTopology.roomProjects,
        repairedTopology.projectFiles
      );
      const projectFiles = defaults.projectFiles;
      const workspaceReferenceDocs = sortWorkspaceReferenceDocs(
        repairedTopology.workspaceReferenceDocs
          .filter((doc) =>
            defaults.roomProjects.some((project) => project.id === doc.projectId)
          )
      );
      const roomProjects = reconcileRoomProjects(
        defaults.roomProjects,
        cards,
        projectFiles
      );
      const migratedImageCards = await Promise.allSettled(
        payload.imageCards.map((card) => migrateLegacyImageCard(card))
      );
      const imageCards = sortImageCards(
        migratedImageCards.flatMap((result, index) => {
          if (result.status === 'fulfilled') {
            return [result.value];
          }

          const failedCardId = payload.imageCards[index]?.id ?? 'unknown';
          console.warn(`[store:persist] image card ${failedCardId} migration failed`, result.reason);
          return [];
        })
      );
      set({
        cards,
        projectFiles,
        workspaceReferenceDocs,
        roomProjects,
        imageCards,
        deletedBundledCardIds,
        hydrated: true
      });
      return;
    }

    const defaults = includeDefaultCollectionProjects([], []);
    set({
      cards: includeDefaultCollectionCards([]),
      projectFiles: defaults.projectFiles,
      workspaceReferenceDocs: [],
      roomProjects: defaults.roomProjects,
      imageCards: [],
      deletedBundledCardIds: [],
      hydrated: true
    });
  },

  persistToDb: async () => {
    // The serialization queue now lives inside writeCollectionState, so persistToDb
    // must not hold it: writeCollectionState calls the collection row writer, which
    // would deadlock if this layer were already holding the same queue.
    const { cards, projectFiles, workspaceReferenceDocs, roomProjects, imageCards, deletedBundledCardIds } = get();
    await writeCollectionState({ cards, projectFiles, workspaceReferenceDocs, roomProjects, imageCards, deletedBundledCardIds });
  }
}));
