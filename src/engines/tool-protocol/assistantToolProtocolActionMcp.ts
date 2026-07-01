import type { McpResolvedToolDefinition } from '../mcpRuntime';
import { asObject } from './assistantToolProtocolShared';
import type { ParseActionResult } from './assistantToolProtocolActionShared';
import { normalizeOptionalString } from './assistantToolProtocolActionShared';

export type AssistantToolActionMcpParseContext = {
  mcpTools?: McpResolvedToolDefinition[];
};

const MCP_META_KEYS = new Set(['kind', 'targetLabel']);

function normalizeMcpArguments(action: Record<string, unknown>) {
  const explicitArguments = asObject(action.arguments);
  if (explicitArguments) return explicitArguments;

  const explicitArgs = asObject(action.args);
  if (explicitArgs) return explicitArgs;

  return Object.fromEntries(
    Object.entries(action).filter(([key]) => !MCP_META_KEYS.has(key))
  );
}

export function parseMcpToolAction(
  action: Record<string, unknown>,
  context?: AssistantToolActionMcpParseContext
): ParseActionResult | null {
  const schemaName = typeof action.kind === 'string' ? action.kind.trim() : '';
  if (!schemaName.startsWith('mcp__')) return null;

  const tool = (context?.mcpTools ?? []).find((entry) => entry.schemaName === schemaName);
  if (!tool) {
    return { action: null, issue: `MCP 工具「${schemaName}」当前不可用。` };
  }

  return {
    action: {
      kind: 'invokeMcpTool',
      serverId: tool.serverId,
      serverName: tool.serverName,
      schemaName: tool.schemaName,
      toolName: tool.toolName,
      argumentsObject: normalizeMcpArguments(action),
      targetLabel: normalizeOptionalString(action.targetLabel) || `${tool.serverName} / ${tool.toolName}`
    }
  };
}
