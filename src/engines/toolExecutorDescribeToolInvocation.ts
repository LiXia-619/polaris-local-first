import type { ToolAction } from './toolExecutorTypes';
import type { ToolActionDescription } from './toolExecutorDescribe';

export type ToolInvocationToolAction = Extract<
  ToolAction,
  { kind: 'invokeCodeCardTool' | 'invokeMcpTool' }
>;

/**
 * Natural-language descriptions for the tool-invocation actions (calling a room code-card tool or
 * an MCP tool). Pure field formatting — no side effects and no theme/CSS coupling. The central
 * `describeToolAction` dispatcher delegates these kinds here.
 */
export function describeToolInvocationToolAction(action: ToolInvocationToolAction): ToolActionDescription {
  switch (action.kind) {
    case 'invokeCodeCardTool':
      return {
        kind: action.kind,
        title: '调用房间工具',
        summary: `调用房间工具 · ${action.targetLabel || action.toolName}`,
        targetLabel: action.targetLabel
      };
    case 'invokeMcpTool':
      return {
        kind: action.kind,
        title: '调用 MCP 工具',
        summary: `调用 MCP 工具 · ${action.targetLabel || `${action.serverName} / ${action.toolName}`}`,
        targetLabel: action.targetLabel ?? `${action.serverName} / ${action.toolName}`
      };
  }
}
