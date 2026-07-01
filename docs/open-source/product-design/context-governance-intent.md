# Context Governance Intent

Context governance is the part of Polaris that decides what the model sees for a
turn and how each piece is labeled. It exists because an AI collaborator should
receive a readable scene: current user input, recent conversation, memory,
summaries, tool evidence, workspace materials, and room state should each keep
their role.

## Product Intent

Polaris compiles the current working environment into named lanes so the model
can tell which signals are stable facts, recent wording, candidates, summaries,
documents, or tool results.

Good context governance gives the model intuition plus authority labels. A
recalled phrase can restore continuity. A confirmed memory can supply stable
background. A tool result can prove what changed. A directory entry can tell the
model where expandable material exists.

### Context is cognitive terrain, not token budget

Context governance is not a packing exercise. It maps authority, source,
freshness, purpose, and expansion path so the model can orient inside the work.
Token cost matters, but budget decisions serve the terrain: they decide how to
keep the scene readable when the app cannot send everything at once.

### Every context lane has a contract

Each lane should make its contract visible: whether it is a rule, stable fact,
candidate, tool result, reference, recent wording, or expandable directory
entry. A lane's contract tells the model how much authority it carries, how
fresh it is, whether it can be replaced, and where the model can expand it.

This keeps memory from pretending to be a command, retrieved candidates from
pretending to be confirmed facts, and workspace material from crowding out the
latest user message.

## Implementation Shape

### Request assembly

`src/engines/request/requestPreparation.ts` is the main assembly path. It brings
together conversation messages, memory, summaries, recall, workspace materials,
tool results, and capability prompts.

Related paths:

- `src/engines/request/requestContextPlan.ts`
- `src/engines/request/requestContextContent.ts`
- `src/engines/request/requestContextMessages.ts`
- `src/engines/request/requestPromptCapabilities.ts`
- `src/engines/request/requestTruncation.ts`

### Memory and recall lanes

Confirmed memory, semantic recall, summaries, and long reference documents are
separate inputs. They share the purpose of continuity while carrying distinct
authority levels.

Related paths:

- `src/engines/request/requestMemoryPlan.ts`
- `src/engines/request/requestSemanticRecallPlan.ts`
- `src/engines/request/requestConversationSummaryPlan.ts`
- `src/config/memoryReleaseGates.ts`

### Tool replay

Tool results become next-turn context only through explicit projection. This
keeps model-visible action grounded in what the app actually executed.

Related paths:

- `src/engines/request/requestToolResultProjection.ts`
- `src/app/chat/chatToolEvidenceStage.ts`
- `src/app/chat/chatToolCallRecords.ts`

### Receipts and inspection

Polaris records how context was assembled so the app can inspect overlap,
degradation, and lane contribution without treating rendered prompt text as the
only source of truth.

Related paths:

- `src/engines/request/requestContextReceipt.ts`
- `src/engines/request/requestInspector.ts`
- `src/engines/request/requestDebugRuntime.ts`

### Environment directory

The environment directory lets collaborators inspect available scene nodes,
settings, workspace targets, cards, attachments, local host capability, MCP
servers, and memory entry points before choosing a more specific action.

Related paths:

- `src/engines/environmentDirectory.ts`
- `src/engines/toolExecutorDescribeKnowledgeEnvironment.ts`
- `src/stores/runtimeStoreToolbox.ts`

## Adjacent Responsibilities

User tool settings, current app state, backend capability, and explicit data
ownership decide what exists. Context governance arranges that reality for the
model.
