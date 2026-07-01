import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';
import { executeToolActionWithPlugins, type ToolExecutorPlugin } from './toolExecutorPlugins';
import { appToolExecutorPlugin } from './toolExecutorAppPlugin';
import { attachmentToolExecutorPlugin } from './toolExecutorAttachmentPlugin';
import { codeCardToolExecutorPlugin } from './toolExecutorCodeCardPlugin';
import { collectionToolExecutorPlugin } from './toolExecutorCollectionPlugin';
import { mcpToolExecutorPlugin } from './toolExecutorMcpPlugin';
import { themeToolExecutorPlugin } from './toolExecutorThemePlugin';
import { utilityToolExecutorPlugin } from './toolExecutorUtilityPlugin';
import { webToolExecutorPlugin } from './toolExecutorWebPlugin';

export { resolvePreviewableThemePatch } from './toolExecutorThemePlugin';

const DEFAULT_TOOL_EXECUTOR_PLUGINS: ToolExecutorPlugin[] = [
  themeToolExecutorPlugin,
  webToolExecutorPlugin,
  attachmentToolExecutorPlugin,
  collectionToolExecutorPlugin,
  mcpToolExecutorPlugin,
  codeCardToolExecutorPlugin,
  utilityToolExecutorPlugin,
  appToolExecutorPlugin
];

export async function executeToolAction(action: ToolAction, ctx: ToolContext): Promise<ToolExecutionResult> {
  return executeToolActionWithPlugins(action, ctx, DEFAULT_TOOL_EXECUTOR_PLUGINS);
}
