import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DESK_LAMP_ROOM_CARD_ID,
  PHAROS_LIGHTHOUSE_ROOM_CARD_ID,
  createDeskLampRoomCard
} from './collectionStarterCard';
import { resolveDeletedBundledCardIdsForPersistedCards, useCollectionStore } from './collectionStore';
import { normalizeCodeCard, sortCodeCards } from './collectionStoreCodeCards';
import { useChatStore } from './chatStore';
import * as workspaceReferenceDocContentPersistence from './workspaceReferenceDocContentPersistence';

describe('collectionStore card pinning', () => {
  beforeEach(() => {
    useCollectionStore.setState(useCollectionStore.getInitialState(), true);
  });

  it('keeps pinned cards before newer unpinned cards', () => {
    const olderPinned = normalizeCodeCard({
      id: 'older-pinned',
      title: 'Older Pinned',
      language: 'html',
      code: '<main />',
      source: 'manual',
      createdAt: 1,
      updatedAt: 1,
      pinnedAt: 5
    });
    const newer = normalizeCodeCard({
      id: 'newer',
      title: 'Newer',
      language: 'html',
      code: '<main />',
      source: 'manual',
      createdAt: 10,
      updatedAt: 10
    });

    expect(sortCodeCards([newer, olderPinned]).map((card) => card.id)).toEqual([
      'older-pinned',
      'newer'
    ]);
  });

  it('toggles a stored card pin timestamp', () => {
    const card = normalizeCodeCard({
      id: 'card-pin-target',
      title: 'Pin Target',
      language: 'html',
      code: '<main />',
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    });
    useCollectionStore.setState({
      cards: [card],
      projectFiles: [],
      roomProjects: [],
      imageCards: [],
      deletedBundledCardIds: [],
      hydrated: true
    });

    useCollectionStore.getState().toggleCardPinned(card.id);
    expect(useCollectionStore.getState().cards[0]?.pinnedAt).toEqual(expect.any(Number));

    useCollectionStore.getState().toggleCardPinned(card.id);
    expect(useCollectionStore.getState().cards[0]?.pinnedAt).toBeNull();
  });
});

describe('collectionStore bundled card deletion', () => {
  beforeEach(() => {
    useCollectionStore.setState(useCollectionStore.getInitialState(), true);
  });

  it('records a deleted bundled card so hydration does not bring it back', () => {
    useCollectionStore.setState({
      cards: [createDeskLampRoomCard(1000)],
      projectFiles: [],
      roomProjects: [],
      imageCards: [],
      deletedBundledCardIds: [],
      hydrated: true
    });

    useCollectionStore.getState().deleteCard(DESK_LAMP_ROOM_CARD_ID);

    expect(useCollectionStore.getState().cards).toEqual([]);
    expect(useCollectionStore.getState().deletedBundledCardIds).toEqual([DESK_LAMP_ROOM_CARD_ID]);
  });

  it('treats missing bundled cards in an existing collection payload as already deleted', () => {
    const deletedBundledCardIds = resolveDeletedBundledCardIdsForPersistedCards([
      createDeskLampRoomCard(1000)
    ]);

    expect(deletedBundledCardIds).toEqual([
      PHAROS_LIGHTHOUSE_ROOM_CARD_ID
    ]);
  });
});

describe('collectionStore image cards', () => {
  beforeEach(() => {
    useCollectionStore.setState(useCollectionStore.getInitialState(), true);
  });

  it('creates a collection image card from a stored local asset', () => {
    const result = useCollectionStore.getState().createImageCardFromAsset({
      assetId: 'asset-local-png',
      imageName: 'local-poster.png',
      ownerCollaboratorId: 'persona-1',
      source: 'manual'
    });

    expect(result).toMatchObject({
      created: true,
      title: 'local-poster'
    });
    expect(useCollectionStore.getState().imageCards).toHaveLength(1);
    expect(useCollectionStore.getState().imageCards[0]).toMatchObject({
      assetId: 'asset-local-png',
      title: 'local-poster',
      ownerCollaboratorId: 'persona-1',
      source: 'manual'
    });
  });

  it('reuses an existing image card when the asset is already in the collection', () => {
    const first = useCollectionStore.getState().createImageCardFromAsset({
      assetId: 'asset-imported',
      imageName: 'reference.webp',
      source: 'imported'
    });
    const second = useCollectionStore.getState().createImageCardFromAsset({
      assetId: 'asset-imported',
      imageName: 'reference.webp',
      source: 'imported'
    });

    expect(second).toMatchObject({
      cardId: first?.cardId,
      created: false,
      title: 'reference'
    });
    expect(useCollectionStore.getState().imageCards).toHaveLength(1);
  });
});

describe('collectionStore project files', () => {
  beforeEach(() => {
    useCollectionStore.setState(useCollectionStore.getInitialState(), true);
  });

  it('creates project files only inside an existing room project', () => {
    const missingFileId = useCollectionStore.getState().createProjectFile({
      projectId: 'missing-project',
      filePath: 'index.html',
      content: '<main />'
    });

    expect(missingFileId).toBeNull();
    expect(useCollectionStore.getState().projectFiles).toEqual([]);

    const projectId = useCollectionStore.getState().createProject({
      id: 'live-project',
      title: 'Live Project'
    });
    const fileId = useCollectionStore.getState().createProjectFile({
      projectId,
      filePath: 'index.html',
      content: '<main />'
    });

    expect(fileId).toEqual(expect.any(String));
    expect(useCollectionStore.getState().projectFiles).toHaveLength(1);
    expect(useCollectionStore.getState().projectFiles[0]).toMatchObject({
      projectId: 'live-project',
      filePath: 'index.html',
      content: '<main />'
    });
  });
});

describe('collectionStore project pinning', () => {
  beforeEach(() => {
    useCollectionStore.setState(useCollectionStore.getInitialState(), true);
    useChatStore.setState(useChatStore.getInitialState(), true);
  });

  it('toggles a stored project pin timestamp', () => {
    const projectId = useCollectionStore.getState().createProject({
      id: 'project-pin-target',
      title: 'Pin Target'
    });

    useCollectionStore.getState().toggleProjectPinned(projectId);
    expect(useCollectionStore.getState().roomProjects[0]?.pinnedAt).toEqual(expect.any(Number));

    useCollectionStore.getState().toggleProjectPinned(projectId);
    expect(useCollectionStore.getState().roomProjects[0]?.pinnedAt).toBeNull();
  });

  it('clears chat workspace bindings immediately when a project is deleted', () => {
    const projectId = useCollectionStore.getState().createProject({
      id: 'project-bound-to-chat',
      title: 'Bound Project'
    });
    const otherProjectId = useCollectionStore.getState().createProject({
      id: 'project-stays',
      title: 'Stays'
    });
    useCollectionStore.getState().createProjectFile({
      projectId,
      filePath: 'index.html',
      content: '<main />'
    });
    useCollectionStore.getState().createProjectFile({
      projectId: otherProjectId,
      filePath: 'keep.html',
      content: '<section />'
    });
    useCollectionStore.getState().createWorkspaceReferenceDoc({
      projectId,
      title: 'Deleted project notes',
      content: 'notes'
    });
    useCollectionStore.getState().createWorkspaceReferenceDoc({
      projectId: otherProjectId,
      title: 'Kept project notes',
      content: 'keep'
    });
    const conversationId = useChatStore.getState().createConversation('pharos', {
      activeProjectId: projectId
    });

    useCollectionStore.getState().deleteProject(projectId);

    expect(useChatStore.getState().conversations.find((conversation) => conversation.id === conversationId)).toMatchObject({
      activeProjectId: null
    });
    expect(useCollectionStore.getState().projectFiles).toEqual([
      expect.objectContaining({
        projectId: otherProjectId,
        filePath: 'keep.html'
      })
    ]);
    expect(useCollectionStore.getState().workspaceReferenceDocs).toEqual([
      expect.objectContaining({
        projectId: otherProjectId,
        title: 'Kept project notes'
      })
    ]);
    expect(useChatStore.getState().dirtyConversationIds).toContain(conversationId);
  });
});

describe('collectionStore workspace ownership backfill', () => {
  beforeEach(() => {
    useCollectionStore.setState(useCollectionStore.getInitialState(), true);
  });

  it('backfills a conversation-bound workspace owner onto the project and files', () => {
    const projectId = useCollectionStore.getState().createProject({
      id: 'qa-long-diary-workspace',
      title: 'QA 长任务日记工作区'
    });
    useCollectionStore.getState().createProjectFile({
      projectId,
      filePath: 'index.html',
      content: '<main />'
    });

    useCollectionStore.getState().backfillOwnershipFromConversations([
      {
        id: 'conv-qa',
        title: 'QA',
        collaboratorId: 'pharos',
        activeProjectId: projectId,
        messages: [],
        createdAt: 1,
        updatedAt: 1
      }
    ] as never[]);

    expect(useCollectionStore.getState().roomProjects[0]).toMatchObject({
      id: projectId,
      ownerCollaboratorId: 'pharos'
    });
    expect(useCollectionStore.getState().projectFiles[0]).toMatchObject({
      projectId,
      ownerCollaboratorId: 'pharos'
    });
  });
});

describe('collectionStore workspace doc explicit body deletion signal', () => {
  beforeEach(() => {
    useCollectionStore.setState(useCollectionStore.getInitialState(), true);
  });

  it('stages an explicit body deletion when a workspace reference doc is deleted', () => {
    const projectId = useCollectionStore.getState().createProject({ id: 'ws-delete-doc', title: 'WS' });
    const docId = useCollectionStore.getState().createWorkspaceReferenceDoc({
      projectId,
      title: 'Notes',
      content: 'body'
    });
    const stageDeletion = vi.spyOn(workspaceReferenceDocContentPersistence, 'stageWorkspaceReferenceDocDeletion');

    try {
      useCollectionStore.getState().deleteWorkspaceReferenceDoc(docId as string);
      // The body deletion goes through the explicit channel, not through the doc being absent
      // from the next persist's list.
      expect(stageDeletion).toHaveBeenCalledWith(docId);
    } finally {
      stageDeletion.mockRestore();
    }
  });

  it('stages an explicit body deletion for every workspace doc a deleted project owns', () => {
    const projectId = useCollectionStore.getState().createProject({ id: 'ws-delete-project', title: 'WS' });
    const otherProjectId = useCollectionStore.getState().createProject({ id: 'ws-keep-project', title: 'Keep' });
    const ownedDocId = useCollectionStore.getState().createWorkspaceReferenceDoc({
      projectId,
      title: 'Owned',
      content: 'owned body'
    });
    const otherDocId = useCollectionStore.getState().createWorkspaceReferenceDoc({
      projectId: otherProjectId,
      title: 'Kept',
      content: 'kept body'
    });
    const stageDeletion = vi.spyOn(workspaceReferenceDocContentPersistence, 'stageWorkspaceReferenceDocDeletion');

    try {
      useCollectionStore.getState().deleteProject(projectId);
      expect(stageDeletion).toHaveBeenCalledWith(ownedDocId);
      // A doc owned by a surviving project is not staged for deletion.
      expect(stageDeletion).not.toHaveBeenCalledWith(otherDocId);
    } finally {
      stageDeletion.mockRestore();
    }
  });
});
