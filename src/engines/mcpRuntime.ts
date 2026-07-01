// MCP runtime public facade.
//
// The stable entry point for the rest of the app: discover an MCP tool catalog,
// invoke a tool, and the deterministic schema-side tool name. The implementation
// is decomposed across mcpRuntime{Catalog,Http,Sse,Transport,JsonRpc,Timing,
// Attachments}.ts; this barrel re-exports the public surface so callers keep
// importing from `./mcpRuntime` regardless of where the code lives.

export {
  buildMcpSchemaToolName,
  clearMcpToolCatalogCacheForTests,
  invokeMcpTool,
  resolveMcpToolCatalog
} from './mcpRuntimeCatalog';
export type {
  McpResolvedToolDefinition,
  McpToolCatalogResolution,
  McpToolCallResult
} from './mcpRuntimeCatalog';
export type { McpToolAttachmentContent } from './mcpRuntimeAttachments';
