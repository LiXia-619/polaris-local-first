# Memory Intent

Memory gives Polaris continuity between turns, rooms, collaborators, and
working sessions. It is the part of the environment that lets the model arrive
with useful terrain already named: confirmed facts, recent summaries, semantic
recall, reference documents, and visible memory evidence.

The product goal is simple. A model turn should know which facts are durable,
which facts were recalled because they match the current work, and which facts
come from recent conversation flow. The user should be able to treat memory as a
working material rather than as a hidden prompt heap.

## Product Principles

### Recall is layered

Polaris separates memory into lanes. Confirmed memory, semantic recall,
conversation summaries, reference documents, and short recent history all enter
the request with different labels and different confidence.

Implementation evidence:

- `src/engines/request/requestMemoryPlan.ts`
- `src/engines/request/requestSemanticRecallPlan.ts`
- `src/engines/request/requestConversationSummaryPlan.ts`
- `src/engines/request/requestContextContent.ts`
- `src/engines/request/requestContextMessages.ts`

### Memory is context fuel, not a prompt heap

Memory does not enter Polaris as one large block. It becomes fuel for the
context compiler: profile-like facts, confirmed memory, semantic candidates,
quote evidence, conversation summaries, and reference documents each take the
shape that fits the current turn.

This lets memory preserve continuity without overwhelming the model's own
judgment. The model sees enough to recognize the work, and the app keeps larger
materials available as expandable terrain.

Implementation evidence:

- `src/engines/request/requestContextPlan.ts`
- `src/engines/request/requestContextReceipt.ts`
- `src/engines/conversationSummaryMemory.ts`
- `src/engines/conversationSummaryRunner.ts`

### Memory belongs to identities and workspaces

Memory can be attached to collaborators and workspace materials. This keeps
recall close to the product object that owns it, so the model sees memory as
part of a named environment.

Implementation evidence:

- `src/stores/personaStoreVectorIndex.ts`
- `src/stores/personaMemoryReferenceDocPersistence.ts`
- `src/app/chat/memoryVectorIndexActions.ts`
- `src/app/chat/conversationSummaryMemoryActions.ts`
- `src/stores/workspaceReferenceDocContentPersistence.ts`

### Memory evidence is visible

When memory affects a reply, the user can inspect why. Memory evidence appears
in message surfaces and request debugging surfaces instead of remaining a
silent background effect.

Implementation evidence:

- `src/app/chat/chatMemoryEvidence.ts`
- `src/ui/worlds/chat/message/MessageMemoryEvidence.tsx`
- `src/engines/request/requestContextReceipt.ts`
- `src/engines/request/requestInspector.ts`
- `src/ui/RequestDebugOverlay.tsx`

## Adjacent Responsibilities

- Context governance decides how memory lanes join the full request.
- Collaborator settings decide which identity owns a memory source.
- LocalData owns durable storage of memory rows and reference document bodies.
- Chat owns the visible message timeline that displays memory evidence.
