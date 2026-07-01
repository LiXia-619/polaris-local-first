# Sandbox Runtime Intent

The sandbox runtime lets Polaris inspect generated code and project previews.
It is the bridge between a saved artifact and a live, observable result.

The product goal is to let the user and model check whether generated work
behaves like an application, not just like text. A preview can run, report
errors, expose runtime inspection, and open into fullscreen views when the user
wants to evaluate it closely.

## Product Principles

### Previews are part of artifact quality

Runnable cards and project files have preview surfaces. The preview is displayed
beside editing tools so the user can move between source and behavior.

Implementation evidence:

- `src/ui/collection/workshop/CodePreviewStageSurface.tsx`
- `src/ui/collection/workshop/CodeRunFullscreen.tsx`
- `src/ui/collection/cards/CodePreviewFullscreenLayer.tsx`
- `src/ui/collection/cards/RoomProjectRunFullscreen.tsx`
- `src/app/collection/codeCardRunPreview.ts`

### Runtime checks are explicit

Polaris has named code-sandbox and project-preview logic. It can classify
preview state, inspect project files, and report runtime findings as tool
evidence.

Implementation evidence:

- `src/engines/codeSandbox.ts`
- `src/infrastructure/runCodeSandboxMode.ts`
- `src/engines/codeCardPreview.ts`
- `src/engines/roomProjectPreview.ts`
- `src/engines/roomProjectRuntimeInspection.ts`
- `src/engines/projectFileInspection.ts`

### Model tools can request preview inspection

Preview and project inspection tools let the model verify generated artifacts
through the tool system instead of guessing from source text alone.

Implementation evidence:

- `src/engines/toolExecutorCollectionWorkspacePreviewState.ts`
- `src/engines/toolExecutorCollectionProjectDiagnostics.ts`
- `src/engines/tool-protocol/assistantToolPromptWorkspace.ts`
- `src/app/chat/chatToolCollectionContext.ts`
- `src/ui/worlds/chat/message/toolProductCards.ts`

## Adjacent Responsibilities

- Cards and workspaces own saved source materials.
- Tool contracts own invocation records and next-turn replay of inspection
  results.
- Collection world owns preview placement inside browsing and editing surfaces.
- Cross-platform shell owns host capabilities around native file access.
