import { resolveCreativeCssPatch } from './themeCssLayers';
import { serializeThemeCssFile } from './themeCssFile';
import { isToolActionKindHandledByPlugin } from './tool-protocol/toolManifest';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';
import type { ToolExecutorPlugin } from './toolExecutorPlugins';
import type { ToolResult } from './toolResult';

export type ThemeToolAction = Extract<
  ToolAction,
  {
    kind:
      | 'applyThemeCoordinates'
      | 'applySurfaceTokens'
      | 'patchRawCss'
      | 'readThemeCss'
      | 'editThemeCss'
      | 'appendThemeCss'
      | 'insertThemeCss'
      | 'deleteThemeCss'
      | 'replaceThemeCss'
      | 'inspectThemeRender'
      | 'applyPreset';
  }
>;

type ThemePatchResult = ToolResult<{ generatedCssPatch?: string }>;

export function isThemeToolAction(action: ToolAction): action is ThemeToolAction {
  return isToolActionKindHandledByPlugin(action.kind, 'theme');
}

export function resolvePreviewableThemePatch(action: ToolAction): ThemePatchResult {
  if (action.kind === 'patchRawCss') {
    return resolveCreativeCssPatch(action);
  }
  return { ok: true };
}

async function executeThemeToolAction(
  action: ThemeToolAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (action.kind) {
    case 'applyThemeCoordinates':
      return { ok: false, error: '稳定整体换肤需要走试穿链，不能直接执行。' };
    case 'applySurfaceTokens':
      return { ok: false, error: '稳定单点精修需要走试穿链，不能直接执行。' };
    case 'editThemeCss':
      return { ok: false, error: '主题 CSS 编辑需要走试穿链，不能直接执行。' };
    case 'appendThemeCss':
      return { ok: false, error: '主题 CSS 追加需要走试穿链，不能直接执行。' };
    case 'insertThemeCss':
      return { ok: false, error: '主题 CSS 插入需要走试穿链，不能直接执行。' };
    case 'deleteThemeCss':
      return { ok: false, error: '主题 CSS 删除需要走试穿链，不能直接执行。' };
    case 'replaceThemeCss':
      return { ok: false, error: '完整主题替换需要走试穿链，不能直接执行。' };
    case 'readThemeCss': {
      const theme = ctx.readCurrentThemeFrame?.();
      if (!theme) {
        return { ok: false, error: '当前环境没有暴露主题状态，无法读取 theme.css。' };
      }
      return {
        ok: true,
        summary: '已读取当前 theme.css',
        detailText: serializeThemeCssFile(theme)
      };
    }
    case 'inspectThemeRender': {
      if (!ctx.inspectThemeRender) {
        return { ok: false, error: '当前环境不支持读取主题渲染结果。' };
      }
      return ctx.inspectThemeRender();
    }
    case 'patchRawCss': {
      const patchResult = resolvePreviewableThemePatch(action);
      if (!patchResult.ok) {
        return { ok: false, error: patchResult.error };
      }
      ctx.applyThemePatch(patchResult.generatedCssPatch);
      return {
        ok: true,
        detailText: action.css.trim()
      };
    }
    case 'applyPreset':
      ctx.applyThemePreset(action.presetId);
      return { ok: true };
  }
}

export const themeToolExecutorPlugin: ToolExecutorPlugin = {
  name: 'theme',
  canHandle: isThemeToolAction,
  execute: async (action, ctx) => {
    if (!isThemeToolAction(action)) {
      return { ok: false, error: `主题工具无法执行：${action.kind}` };
    }
    return executeThemeToolAction(action, ctx);
  }
};
