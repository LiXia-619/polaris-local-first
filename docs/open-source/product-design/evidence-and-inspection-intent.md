# Evidence And Inspection Intent

Evidence and inspection surfaces make Polaris observable. They show what the
model saw, what tools did, what storage health reports, what runtime checks
found, and which durable facts support the current workspace.

The product goal is to keep AI work auditable without turning every interaction
into a debugging session. Normal surfaces show useful proof, and deeper
inspection surfaces exist when a user or developer needs to trace behavior.

## Product Principles

### Requests can be inspected

Request planning, context receipts, debug runtime state, and debug overlays make
the assembled model environment visible.

Implementation evidence:

- `src/engines/request/requestContextReceipt.ts`
- `src/engines/request/requestInspector.ts`
- `src/engines/request/requestDebugRuntime.ts`
- `src/engines/request/requestDebugRecorder.ts`
- `src/ui/RequestDebugOverlay.tsx`
- `src/ui/useRequestDebugState.ts`

### Tool actions leave a ledger

Tool calls produce invocation records, UI events, summaries, replay projections,
and ledger entries. This lets a later turn rely on completed actions as named
facts.

Implementation evidence:

- `src/app/chat/chatToolEvidenceStage.ts`
- `src/app/chat/chatToolCallRecords.ts`
- `src/engines/toolLedger.ts`
- `src/engines/request/requestToolResultProjection.ts`
- `src/ui/worlds/chat/message/MessageToolEvent.tsx`

### Storage and runtime health are visible

LocalData health, asset health, project diagnostics, preview inspection, and
runtime overlays report whether the environment is coherent.

Implementation evidence:

- `src/infrastructure/localDataHealth.ts`
- `src/infrastructure/localDataHealth/`
- `src/infrastructure/localDataPromotionReadiness.ts`
- `src/engines/roomProjectRuntimeInspection.ts`
- `src/engines/toolExecutorCollectionProjectDiagnostics.ts`
- `src/ui/AssetGovernanceDebugLayer.tsx`

## Adjacent Responsibilities

- Context governance owns request assembly.
- Tool contracts own action semantics and result projection.
- LocalData owns durable rows that health checks inspect.
- Sandbox runtime owns preview behavior that inspection reports.
