import { THEME_COORDINATE_SURFACE_CODE } from '../../engines/theme-coordinate/themeCoordinateSurfaceMeta';

type ThemeInvocationLike = {
  kind?: string;
  status?: string;
};

function dedupeSurfaceCodes(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function isRecentThemeToolInvocation(tool: ThemeInvocationLike | undefined) {
  if (!tool) return false;
  if (tool.status === 'rolled_back' || tool.status === 'superseded' || tool.status === 'failed') {
    return false;
  }

  return (
    tool.kind === 'applyThemeCoordinates'
    || tool.kind === 'applySurfaceTokens'
    || tool.kind === 'patchRawCss'
    || tool.kind === 'readThemeCss'
    || tool.kind === 'editThemeCss'
    || tool.kind === 'appendThemeCss'
    || tool.kind === 'insertThemeCss'
    || tool.kind === 'deleteThemeCss'
    || tool.kind === 'replaceThemeCss'
    || tool.kind === 'inspectThemeRender'
    || tool.kind === 'applyPreset'
  );
}

export function buildExplicitThemeSurfaceCodes(content?: string) {
  const normalized = content?.trim();
  if (!normalized) return [];

  const explicitSurfaceCodes: string[] = [];
  const push = (...codes: string[]) => {
    explicitSurfaceCodes.push(...codes);
  };

  if (/背景|底色|底板|底子|背景色/.test(normalized)) {
    push(THEME_COORDINATE_SURFACE_CODE.background);
  }
  if (/顶栏|顶部|标题栏/.test(normalized)) {
    push(THEME_COORDINATE_SURFACE_CODE.topbar);
  }
  if (/发送栏|输入框|输入栏|输入区|底部输入/.test(normalized)) {
    push(THEME_COORDINATE_SURFACE_CODE.composer);
  }
  if (/系统框|系统提示|提示框|状态框/.test(normalized)) {
    push(THEME_COORDINATE_SURFACE_CODE['system-note']);
  }
  if (/面板|弹窗|浮层|人格面板|设置面板/.test(normalized)) {
    push(THEME_COORDINATE_SURFACE_CODE.panel);
  }
  if (/卡片|收藏卡|对话卡|房间卡|图片卡/.test(normalized)) {
    push(THEME_COORDINATE_SURFACE_CODE.card);
  }
  if (/气泡|bubble/i.test(normalized)) {
    const wantsAssistantBubble = /回复气泡|助手气泡|AI气泡|给你自己.{0,8}气泡|你自己.{0,8}气泡|左侧气泡/i.test(normalized);
    const wantsUserBubble = /我的气泡|我自己的气泡|用户气泡|右侧气泡/i.test(normalized);
    if (wantsAssistantBubble) push(THEME_COORDINATE_SURFACE_CODE['chat-ai-bubble']);
    if (wantsUserBubble) push(THEME_COORDINATE_SURFACE_CODE['chat-user-bubble']);
    if (!wantsAssistantBubble && !wantsUserBubble) {
      push(THEME_COORDINATE_SURFACE_CODE['chat-user-bubble']);
    }
  }

  return dedupeSurfaceCodes(explicitSurfaceCodes);
}
