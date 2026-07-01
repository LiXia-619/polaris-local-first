import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';
import type { ToolExecutorPlugin } from './toolExecutorPlugins';
import { isToolActionKindHandledByPlugin } from './tool-protocol/toolManifest';

export type AppToolAction = Extract<
  ToolAction,
  {
    kind: 'switchWorld';
  }
>;

export function isAppToolAction(action: ToolAction): action is AppToolAction {
  return isToolActionKindHandledByPlugin(action.kind, 'app');
}

async function executeAppToolAction(
  action: AppToolAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (action.kind) {
    case 'switchWorld':
      ctx.setWorld(action.world);
      return { ok: true };
  }
}

export const appToolExecutorPlugin: ToolExecutorPlugin = {
  name: 'app',
  canHandle: isAppToolAction,
  execute: async (action, ctx) => {
    if (!isAppToolAction(action)) {
      return { ok: false, error: `应用工具无法执行：${action.kind}` };
    }
    return executeAppToolAction(action, ctx);
  }
};
