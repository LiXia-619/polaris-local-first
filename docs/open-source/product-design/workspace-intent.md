# Workspace Intent

Workspaces give generated and imported project materials a place to live. A
workspace can hold files, project structure, preview entry points, reference
documents, desktop sync state, and chat feedback.

The product goal is to make AI-assisted project work feel continuous. The user
should be able to move from a model proposal into editable files, inspect a
preview, update project materials, and return to chat with the same workspace
still in scope.

## Product Principles

### Workspaces organize project materials

Project files, file trees, project cards, references, and runnable entry points
are modeled as collection-backed workspace data.

Implementation evidence:

- `src/engines/roomProjects.ts`
- `src/stores/collectionStoreProjectFiles.ts`
- `src/stores/collectionStoreProjectTopology.ts`
- `src/stores/collectionStoreWorkspaceReferences.ts`
- `src/ui/collection/cards/RoomProjectFileTree.tsx`

### Workspace editing is a product surface

The collection world provides project shelves, fullscreen project views, file
editing, reference editing, and navigation between project materials.

Implementation evidence:

- `src/ui/worlds/collection/CodeProjectCollectionShelfPages.tsx`
- `src/ui/collection/cards/ProjectCollectionShelf.tsx`
- `src/ui/collection/cards/RoomProjectFullscreen.tsx`
- `src/ui/collection/workshop/ProjectFileCodeWorkshop.tsx`
- `src/ui/collection/workshop/ProjectFileTextWorkshop.tsx`

### Chat can stay scoped to a workspace

Workspace proposals, banners, references, and feedback keep a conversation tied
to the project object the user is working on.

Implementation evidence:

- `src/ui/worlds/chat/composer/ChatWorkspaceBanner.tsx`
- `src/ui/worlds/chat/workspaceProposalActions.ts`
- `src/app/chat/workspaceScopeContract.test.ts`
- `src/stores/chatWorkspaceFeedback.ts`
- `src/engines/workspaceBinding.ts`

## Adjacent Responsibilities

- Cards own single saved artifacts.
- Sandbox runtime owns preview execution and runtime inspection.
- Desktop companion owns host-level file synchronization when that capability is
  available.
- Collection world owns browsing and saved-object navigation.
