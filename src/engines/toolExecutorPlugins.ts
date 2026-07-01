import {
  resolveToolExecutorPluginId,
  type PolarisToolExecutorPluginId
} from './tool-protocol/toolManifest';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';

export type ToolExecutorPlugin = {
  name: PolarisToolExecutorPluginId;
  canHandle: (action: ToolAction) => boolean;
  execute: (action: ToolAction, context: ToolContext) => Promise<ToolExecutionResult>;
};

export async function executeToolActionWithPlugins(
  action: ToolAction,
  context: ToolContext,
  plugins: ToolExecutorPlugin[]
): Promise<ToolExecutionResult> {
  const pluginId = resolveToolExecutorPluginId(action.kind);
  const plugin = plugins.find((candidate) => candidate.name === pluginId && candidate.canHandle(action)) ?? null;
  if (!plugin) {
    return { ok: false, error: `没有找到可执行工具：${action.kind}` };
  }

  try {
    return await plugin.execute(action, context);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '工具执行失败。'
    };
  }
}
