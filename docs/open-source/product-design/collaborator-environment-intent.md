# Collaborator Environment Intent

Collaborators are the human-facing identity layer of Polaris. A collaborator is
a long-lived role with identity, behavior settings, memory boundaries, tool
permissions, room behavior, and saved materials.

## Product Intent

The user should be able to return to a collaborator and feel continuity:
conversation history, memory settings, provider choice, tool permissions, room
presence, and collection artifacts should still point at the same identity.

For the model, collaborator identity is part of the environment. The request
should make it clear who is speaking, which memory belongs to that
collaborator, which tools are available, and whether the collaborator is in a
private conversation or a shared room.

## Implementation Shape

### Persona directory and settings

The persona domain owns collaborator rows, settings projection, and builder
configuration.

Implementation evidence:

- `src/stores/personaStore.ts`
- `src/app/persona/`
- `src/config/persona/personaBuilder.ts`
- `src/stores/personaLocalDataPersistence.ts`

### Builder output is durable identity

The collaborator builder turns user choices into a natural-language identity
prompt. Its job is to help a collaborator keep a stable self-shape across rooms,
tools, memory, and work sessions.

That identity is written for the model as a clear second-person shape. The app
keeps role, tone, name, relationship, and behavior settings structured enough
to compile, while still leaving room for user-authored customization.

Implementation evidence:

- `src/app/persona/builder/vibeBuilderModel.ts`
- `src/app/persona/builder/builderHandoff.ts`
- `src/engines/personaCompiler.ts`
- `src/engines/promptCompiler.ts`
- `src/engines/request/requestPromptSystemIdentity.ts`

### Memory ownership

Collaborator memory and reference documents are attached to the persona layer,
while document bodies keep their own storage responsibility.

Implementation evidence:

- `src/stores/personaMemoryReferenceDocPersistence.ts`
- `src/engines/request/requestMemoryPlan.ts`
- `src/engines/request/requestSemanticRecallPlan.ts`

### Chat selection

Chat uses collaborator identity to shape the active conversation, tool
preferences, request context, and message presentation.

Implementation evidence:

- `src/app/chat/chatCollaboratorOwner.ts`
- `src/app/chat/chatConversationCollaborator.ts`
- `src/ui/worlds/chat/collaborator/CollaboratorCreatePicker.tsx`
- `src/ui/worlds/chat/context/ChatContext.tsx`

### Group rooms

A collaborator remains themself inside a group room. Group request shaping
preserves member identity while narrowing tools and adding room context.

Implementation evidence:

- `src/app/group/groupRequestModel.ts`
- `src/app/group/useGroupLaneController.ts`
- `src/app/group/useGroupWorldController.ts`

## Adjacent Responsibilities

The collaborator environment owns identity and behavior projection. Runtime
modules own provider credential policy. Document modules own document body
storage. Collection modules own saved object storage.

Related docs:

- `docs/open-source/modules/persona.md`
- `docs/open-source/memory-and-group-chat-intent.md`
