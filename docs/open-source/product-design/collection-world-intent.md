# Collection World Intent

Collection is the world where saved materials live outside the linear chat. It
holds cards, image assets, files, projects, room artifacts, collaborator-scoped
materials, and creation flows.

The product goal is to give AI output a durable home. The user can browse,
filter, open, edit, preview, export, and reconnect saved materials to chat
without treating the conversation timeline as the only workspace.

## Product Principles

### Saved materials are browsable objects

The collection world presents saved cards, images, files, and projects as
objects with type-specific shelves and actions.

Implementation evidence:

- `src/ui/worlds/CollectionWorld.tsx`
- `src/ui/collection/grid/DialogueCollectionShelf.tsx`
- `src/ui/collection/cards/CodeCollectionShelf.tsx`
- `src/ui/collection/images/ImageCollectionShelf.tsx`
- `src/ui/collection/files/FileCollectionSection.tsx`

### Collection state joins storage and presentation

Collection store slices, LocalData persistence, and UI controllers keep saved
objects coherent across browsing, editing, import, export, and hydration.

Implementation evidence:

- `src/stores/collectionStore.ts`
- `src/stores/collection/localData.ts`
- `src/stores/collectionLocalDataPersistence.ts`
- `src/stores/collectionPersistenceCommitQueue.ts`
- `src/app/collection/useCollectionWorldController.ts`

### Collection can be scoped by collaborator and room

Saved materials can remain attached to the people and rooms that produced them.
This lets collection browsing stay grounded in the environment that generated
the work.

Implementation evidence:

- `src/ui/collection/grid/CollaboratorScopeStrip.tsx`
- `src/ui/collection/info/CollaboratorInfoShelf.tsx`
- `src/engines/collectionOwnership.ts`
- `src/stores/collectionStoreWorkspaceReferences.ts`
- `src/app/collection/conversationCardSummary.ts`

### Rooms preserve traces

A collaborator room is a place where saved traces can accumulate: cards, images,
files, projects, and references. Those traces make identity feel spatial. They
also give the model a natural place to leave useful work without forcing every
artifact to remain in the chat timeline.

Room materials keep paths back to their source context when that origin exists.
This lets the user move from room to conversation and back again without losing
the work's provenance.

Implementation evidence:

- `src/engines/collectionOwnership.ts`
- `src/app/collection/useCollectionWorldController.ts`
- `src/app/collection/useCodeCollectionChatBridge.ts`
- `src/stores/spaceStoreFrontstageActions.ts`
- `src/ui/collection/cards/CodeCardSourceActions.tsx`

## Adjacent Responsibilities

- Chat owns turn lifecycle and live reply composition.
- Cards, workspaces, assets, and files own type-specific editing behavior.
- LocalData owns durable collection rows and asset references.
- Import/export owns package movement across the backup boundary.
