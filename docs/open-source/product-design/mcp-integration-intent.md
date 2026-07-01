# MCP Integration Intent

MCP integration lets user-configured external servers join the Polaris tool
environment. It gives the model access to capabilities that live outside the app
while keeping those capabilities visible through the same tool contract as local
actions.

The product goal is to make external tools feel native to the working scene.
Configured servers appear in settings, expose catalogs, accept structured
requests, return inspectable results, and can include attachments when a tool
needs files.

## Product Principles

### MCP servers are configured capabilities

The user controls server configuration, transport settings, and timeout behavior.
Polaris reads those settings into runtime state and uses them to build the
available MCP catalog.

Implementation evidence:

- `src/stores/runtimeStoreMcp.ts`
- `src/ui/shell/menu/MenuMcpPage.tsx`
- `src/ui/shell/menu/McpServerEditorSheet.tsx`
- `src/ui/shell/menu/McpJsonEditorSheet.tsx`
- `src/ui/shell/menu/McpTimeoutSheet.tsx`

### MCP tools enter the common tool surface

MCP discovery and execution connect to the same model-visible tool protocol used
by local tools. The model sees an action, Polaris resolves the server/tool, and
execution returns a structured result.

Implementation evidence:

- `src/engines/mcpRuntimeCatalog.ts`
- `src/engines/tool-protocol/toolRegistryMcpTools.ts`
- `src/engines/tool-protocol/assistantToolProtocolActionMcp.ts`
- `src/engines/toolExecutorMcpPlugin.ts`
- `src/engines/mcpHandle.ts`

### Transport and payloads are explicit

The MCP runtime separates HTTP, SSE, JSON-RPC, attachment packaging, timing, and
transport concerns. That separation lets the app report failures at the layer
where they occur.

Implementation evidence:

- `src/engines/mcpRuntime.ts`
- `src/engines/mcpRuntimeHttp.ts`
- `src/engines/mcpRuntimeSse.ts`
- `src/engines/mcpRuntimeJsonRpc.ts`
- `src/engines/mcpRuntimeAttachments.ts`
- `src/engines/mcpRuntimeTransport.ts`
- `src/engines/mcpRuntimeTiming.ts`

## Adjacent Responsibilities

- Tool contracts own model visibility, parser behavior, and result projection.
- Runtime settings own configured server records.
- Attachments own file preparation before an MCP tool receives user material.
- Provider runtime owns model transport and reply streaming.
