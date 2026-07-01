# Cards Intent

Cards turn useful AI output into durable objects. A card can preserve code,
text, source context, tags, face styling, origin data, and links back to the
conversation or room that produced it.

The product goal is to stop useful work from dissolving into the chat timeline.
When output becomes a card, the user can inspect it, edit it, preview it, export
it, and carry it into a workspace.

## Product Principles

### A card is a saved artifact

Cards store content and presentation as collection objects. The collection owns
their durable identity, while chat and group rooms can create or reference them.

Implementation evidence:

- `src/stores/collectionStoreCodeCards.ts`
- `src/engines/codeCardEngine.ts`
- `src/engines/collectionCardFace.ts`
- `src/engines/collectionCardOrigin.ts`
- `src/app/collection/codeCardPresentation.ts`

### Editing happens in a focused workshop

The workshop surfaces card content, metadata, preview, export, and source
actions as one editing experience. This lets a card become a practical working
object rather than a static saved message.

Implementation evidence:

- `src/ui/collection/workshop/CodeWorkshop.tsx`
- `src/ui/collection/workshop/TextReadingWorkshop.tsx`
- `src/ui/collection/cards/CodeCardFace.tsx`
- `src/ui/collection/cards/CodeCardSourceActions.tsx`
- `src/ui/collection/cards/exportCodeCardDraft.ts`

### Cards can be created by model tools

The model can create and update cards through tool actions. These writes land in
collection state and leave tool evidence in chat.

Implementation evidence:

- `src/app/chat/chatCodeCardActions.ts`
- `src/engines/toolExecutorCodeCardPlugin.ts`
- `src/engines/toolExecutorCollectionCodeCards.ts`
- `src/engines/tool-protocol/assistantToolProtocolActionRoomProjects.ts`
- `src/app/chat/chatMessageCardReference.ts`

## Adjacent Responsibilities

- Sandbox runtime owns execution and preview behavior for runnable code.
- Workspaces own multi-file project organization.
- Collection world owns browsing, filtering, and saved-object navigation.
- Tool contracts own model-visible write protocol and result evidence.
