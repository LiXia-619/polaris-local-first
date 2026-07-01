# Design Philosophy

Polaris is a local-first AI workspace that gives the model a readable working
environment. The product is built around a simple idea: a stronger model needs a
clearer scene.

The app arranges identity, memory, tools, saved materials, room boundaries, and
durable local facts so the model can understand where it is and what it can act
on. The user should feel that work continues across sessions. The model should
receive enough structured context to continue that work without guessing which
signals are stable, recent, derived, or executable.

## Product Principles

### Environment before instruction

Polaris shapes the surroundings of a model turn. Chat, memory, tools, cards,
workspaces, and collaborators are product objects with names and owners. They
carry prompt text, UI state, durable storage, and tool capability together.

Implementation evidence:

- `src/engines/request/requestPreparation.ts`
- `src/engines/request/requestContextContent.ts`
- `src/engines/environmentDirectory.ts`
- `src/engines/tool-protocol/`

### Identity persists across work

Collaborators are long-lived identities. A collaborator can have model settings,
memory controls, tool permissions, room settings, and saved materials. This
keeps the AI environment personal while giving each identity durable product
shape.

Implementation evidence:

- `src/stores/personaStore.ts`
- `src/app/persona/`
- `src/config/persona/personaBuilder.ts`
- `src/stores/personaLocalDataPersistence.ts`

### Outputs become objects

Useful model output can become a card, image, file, reference document, or room
project. This lets the user move between chat, collection, preview, editing, and
workspace surfaces without losing origin or ownership.

Implementation evidence:

- `src/ui/worlds/CollectionWorld.tsx`
- `src/app/collection/`
- `src/ui/collection/`
- `src/stores/collectionStore.ts`

### Tools leave evidence

Model-visible tools are contracts. A tool should be visible to the model,
parsed into a supported action, executed by the app, shown to the user, and
available as evidence for a later request.

Implementation evidence:

- `src/app/chat/chatToolActionRunner.ts`
- `src/app/chat/chatToolEvidenceStage.ts`
- `src/engines/request/requestToolResultProjection.ts`
- `src/engines/tool-protocol/`

### Durable facts support the scene

Local data is the foundation below the environment. Durable facts should have
documented owners, while UI stores remain projection and orchestration surfaces.

Implementation evidence:

- `src/engines/localData/`
- `src/stores/storeLocalDataBackendHost.ts`
- `src/app/bootstrap/storeLocalDataBackendBootstrap.ts`
- `docs/open-source/data-and-storage-intent.md`

## Reading Order

Read this note with:

- [Context governance intent](context-governance-intent.md)
- [Collaborator environment intent](collaborator-environment-intent.md)
- [Cards intent](cards-intent.md)
- [Sandbox runtime intent](sandbox-runtime-intent.md)
