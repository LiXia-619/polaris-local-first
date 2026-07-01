import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';
import type { ToolExecutorPlugin } from './toolExecutorPlugins';
import { isToolActionKindHandledByPlugin } from './tool-protocol/toolManifest';

export type McpToolAction = Extract<ToolAction, { kind: 'invokeMcpTool' }>;

export function isMcpToolAction(action: ToolAction): action is McpToolAction {
  return isToolActionKindHandledByPlugin(action.kind, 'mcp');
}

async function executeMcpToolAction(action: McpToolAction, ctx: ToolContext): Promise<ToolExecutionResult> {
  const result = await ctx.invokeMcpTool(
    action.serverId,
    action.toolName,
    action.argumentsObject
  );
  if (!result.ok) {
    return {
      ok: false,
      error: result.error
    };
  }

  return {
    ok: true,
    summary: `${result.isError ? 'MCP 工具返回错误' : '已调用 MCP 工具'} · ${action.targetLabel || action.toolName}`,
    detailText: result.detailText,
    attachments: result.attachments,
    mcpResult: {
      serverId: action.serverId,
      serverName: action.serverName,
      toolName: action.toolName,
      argumentsObject: action.argumentsObject,
      ...(action.schemaName ? { schemaName: action.schemaName } : {}),
      ...(result.isError !== undefined ? { isError: result.isError } : {}),
      ...(result.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {})
    }
  };
}

export const mcpToolExecutorPlugin: ToolExecutorPlugin = {
  name: 'mcp',
  canHandle: isMcpToolAction,
  execute: async (action, ctx) => {
    if (!isMcpToolAction(action)) {
      return { ok: false, error: `MCP 工具无法执行：${action.kind}` };
    }
    return executeMcpToolAction(action, ctx);
  }
};
