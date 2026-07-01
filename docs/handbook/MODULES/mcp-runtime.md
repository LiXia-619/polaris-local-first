# MCP runtime engine

How Polaris talks to MCP servers: discovering their tool catalogs and invoking tools over either
the streamable-HTTP transport or the legacy SSE transport. This is the engine layer (`src/engines`),
not the runtime *persistence* domain (`src/stores/runtime`, see `runtime.md`) — the two share the
word "runtime" but nothing else.

## Layout

```
src/engines/
  mcpRuntime.ts             — public re-export barrel (no logic)
  mcpRuntimeCatalog.ts      — tool catalog discovery + retry + cache + tools/call invocation glue
  mcpRuntimeAttachments.ts  — pure projection of a tools/call result → text summary + attachments
  mcpRuntimeJsonRpc.ts      — pure JSON-RPC 2.0 message types, id gen, response pick + assert
  mcpRuntimeTiming.ts       — pure async timing: timeout Error, sleep, promise/timeout race
  mcpRuntimeTransport.ts    — shared transport core: handshake identity, fetch/options, headers, SSE frame parse
  mcpRuntimeHttp.ts         — streamable HTTP transport: native bridge + session lifecycle + response parse
  mcpRuntimeSse.ts          — legacy SSE transport: persistent GET stream + id-correlated POST requests
  mcpHandle.ts              — stable server handle derivation (pre-existing)
```

The split is **done** — `mcpRuntime.ts` is a 20-line barrel with no logic. The decomposition went
attachment projection → JSON-RPC + timing → shared transport core + HTTP → SSE → catalog, each a
behavior-preserving slice verified with `npm run typecheck`, `npm test`, and `npm run build`.

### Public API (unchanged, all on `mcpRuntime.ts`)

External callers still import everything from `src/engines/mcpRuntime`:

- `resolveMcpToolCatalog(args)` — discover + cache the active servers' tools.
- `invokeMcpTool(args)` — call one tool, returns `McpToolCallResult`.
- `clearMcpToolCatalogCacheForTests()` — test seam over the module-level catalog cache.
- `buildMcpSchemaToolName(server, toolName)` — deterministic schema-side tool name.
- Types: `McpResolvedToolDefinition`, `McpToolCatalogResolution`, `McpToolCallResult`, and
  `McpToolAttachmentContent` (re-exported from `mcpRuntimeAttachments` so the import path is stable
  for `chatToolExecutionContext.ts`).

## First slice (done): result/attachment projection

`mcpRuntimeAttachments.ts` owns the *pure* transformation of a raw `tools/call` JSON-RPC result
into what the chat layer consumes. It has **no I/O** — no `fetch`, no `CapacitorHttp`, no SSE
session state, no catalog cache, no timers. The catalog invocation layer produces the raw
transport result and hands it here.

What moved:

- Text summary: `formatToolsCallResult` (and its private helper `formatToolContentItem`).
- Attachment extraction: `extractToolAttachmentContent`, plus the private helpers
  `extractResourceAttachmentContent`, `buildMcpAttachmentName`, `nameFromResourceUri`,
  `safeAttachmentName`, `readMimeType`, `extensionFromMimeType`, `base64DataUrl`, `textDataUrl`.
- Types: `ToolsCallResult` (the raw result shape) and `McpToolAttachmentContent` (the projected
  descriptor). The facade imports both via `import type` and re-exports
  `McpToolAttachmentContent` for callers.

`mcpRuntimeCatalog.ts`'s `callToolViaStreamableHttp` / `callToolViaLegacySse` do the request, then
call `extractToolAttachmentContent` + `formatToolsCallResult` to build the `McpToolCallResult`.
Only the two value imports cross the boundary; types are `import type` to keep it acyclic.

Behavior is unchanged — `mcpRuntime.test.ts` (which exercises attachments through `invokeMcpTool`)
passes untouched.

## Second slice (done): JSON-RPC core + timing

The "JSON-RPC core + timeout helpers" cut landed as **two** focused modules instead of one, because
message shaping and async timing are genuinely distinct concerns with separate (and broader) sets
of consumers. Both are pure — no I/O, no session state.

- `mcpRuntimeJsonRpc.ts` — the `JsonRpc*` message types (`JsonRpcId`, `JsonRpcRequest`,
  `JsonRpcNotification`, `JsonRpcMessage`), `createRpcId`, `parseJsonRpcMessage`,
  `findResponseMessage`, `ensureSuccessMessage`. These types are internal to the engine (not part
  of the public API), so the facade imports them via `import type` with no re-export. The HTTP and
  SSE transports both depend on this module.
- `mcpRuntimeTiming.ts` — `createTimeoutError`, `wait`, `withTimeout`. Used by both transports
  (request timeouts / abort) and by the catalog retry loop (`wait` between attempts).

## Third slice (done): streamable HTTP transport + shared transport core

The HTTP transport came out as **two** modules. The crux was that the SSE wire-frame parser
(`parseSseEvents`) and the fetch/header primitives are used by *both* transports — a streamable POST
can come back as `text/event-stream`, and the legacy SSE connection does its own `fetch`. To extract
HTTP without coupling it to SSE, the genuinely shared primitives landed in a small core first.

- `mcpRuntimeTransport.ts` (shared core) — the handshake identity (`MCP_PROTOCOL_VERSION`,
  `MCP_CLIENT_INFO`), the per-request `McpTransportOptions` and the `initialize` `InitializeResult`
  shape, `getFetchImpl`, `buildServerHeaders`, and the pure `parseSseEvents` frame parser. No session
  state, no dispatch. Both transports import from here.
- `mcpRuntimeHttp.ts` (streamable HTTP) — the native CapacitorHttp bridge
  (`shouldUseNativeMcpHttp`, `serializeNativeHttpBody`, `createResponseFromNativeHttp`,
  `requestMcpHttp`), the single-response parse (`dispatchJsonRpcFromSseData`, `readSseResponseForId`,
  `parseHttpJsonRpcResponse`), and the streamable session lifecycle (`StreamableSession`,
  `postStreamableJsonRpc`, and the three exported entrypoints `initializeStreamableSession`,
  `requestStreamableJsonRpc`, `closeStreamableSession`). This is the only module that imports
  `@capacitor/core`; the facade no longer does.

The catalog/invocation glue (`listToolsViaStreamableHttp`, `callToolViaStreamableHttp`) now lives in
`mcpRuntimeCatalog.ts` and calls the three exported session entrypoints. `StreamableSession` is not
exported — the glue passes plain object literals and TS checks them structurally.

## Fourth slice (done): legacy SSE transport

`mcpRuntimeSse.ts` owns the older two-channel transport: a long-lived GET stream that delivers an
`endpoint` event and then server→client JSON-RPC messages, plus id-correlated POST requests to that
endpoint. It moved `openLegacySseConnection`, `consumeSseStream`, `initializeLegacySseConnection`,
the SSE-only `decodeText` and `createDeferred`, and the `PendingSseResponse` / `LegacySseConnection`
session-state types. It imports the shared core (`mcpRuntimeTransport.ts`), JSON-RPC, and timing
exactly as `mcpRuntimeHttp.ts` does — the core was already in place, so there was no new
shared-primitive decision.

Only `initializeLegacySseConnection` is exported (the catalog glue calls it and uses the returned
`connection`'s `request`/`close` via inferred types); the connection internals and types stay
private. After this slice the facade no longer imports `@capacitor/core`, the transport core's fetch
helpers, or the JSON-RPC message types — both transports are fully external.

## Fifth slice (done): tool catalog + cache + invocation

`mcpRuntimeCatalog.ts` is the orchestration layer over the two transports. It owns catalog discovery
(`listToolsViaStreamableHttp` / `listToolsViaLegacySse`), normalization
(`normalizeDiscoveredTools`, `normalizeToolNameFragment`, `normalizeInputSchema`, `dedupeSchemaNames`,
`buildMcpSchemaToolName`), the retry + module-level cache (`resolveServerToolsWithRetry`,
`buildMcpCatalogCacheKey`, `normalizeTimeoutMs`, `listServerTools`, and the `mcpToolCatalogCache`
map), and the `tools/call` invocation glue (`callToolViaStreamableHttp` / `callToolViaLegacySse`,
which bridge a transport result into attachment projection). The catalog-domain types
(`McpResolvedToolDefinition`, `McpToolCatalogResolution`, `McpToolCallResult`) are defined here too.

`clearMcpToolCatalogCacheForTests` lives in this module because the cache it clears is module-level
state here — co-locating them keeps the test seam honest.

`mcpRuntime.ts` is now a **20-line re-export barrel** with no logic: it re-exports
`resolveMcpToolCatalog`, `invokeMcpTool`, `buildMcpSchemaToolName`, `clearMcpToolCatalogCacheForTests`
and the catalog types from `mcpRuntimeCatalog.ts`, plus `McpToolAttachmentContent` from
`mcpRuntimeAttachments.ts`. Every external caller (`chatToolExecutionContext.ts`, the chat runtime,
the tool-protocol registry, `mcpRuntime.test.ts`, …) keeps importing from `./mcpRuntime` unchanged.

## Done

The god-module is fully decomposed. There is no remaining slice. Future work on MCP behavior should
land in the responsibility module that owns it (transport bug → `mcpRuntimeHttp.ts` /
`mcpRuntimeSse.ts`; catalog/cache → `mcpRuntimeCatalog.ts`; result shaping → `mcpRuntimeAttachments.ts`)
and only touch `mcpRuntime.ts` when the *public surface* itself changes.
