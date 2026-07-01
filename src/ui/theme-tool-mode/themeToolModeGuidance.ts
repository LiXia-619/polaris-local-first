import type { I18nTranslator } from '../../i18n';
import type { ThemeToolMode } from '../../types/domain';

const CREATIVE_MODE_WARNING_SEEN_KEY = 'polaris-theme-tool-mode-creative-warning-seen';

type Translate = I18nTranslator['t'];

function localizeThemeMode(
  t: Translate | undefined,
  key: Parameters<Translate>[0],
  fallback: string,
  values?: Parameters<Translate>[1]
) {
  return t ? t(key, values) : fallback;
}

export function getThemeToolModeLabel(mode: ThemeToolMode, t?: Translate) {
  switch (mode) {
    case 'off':
      return localizeThemeMode(t, 'theme.toolMode.label.off', '关闭');
    case 'stable':
      return localizeThemeMode(t, 'theme.toolMode.label.stable', '稳态');
    case 'creative':
    default:
      return localizeThemeMode(t, 'theme.toolMode.label.creative', '开放');
  }
}

export function resolveEffectiveThemeToolMode(
  mode: ThemeToolMode,
  themeToolsEnabled: boolean
): ThemeToolMode {
  return themeToolsEnabled ? mode : 'off';
}

export function getNextThemeToolMode(mode: ThemeToolMode): ThemeToolMode {
  switch (mode) {
    case 'stable':
      return 'off';
    case 'off':
      return 'creative';
    case 'creative':
    default:
      return 'stable';
  }
}

export function buildThemeToolModeSwitchHint(mode: ThemeToolMode, t?: Translate) {
  const current = getThemeToolModeLabel(mode, t);
  const next = getThemeToolModeLabel(getNextThemeToolMode(mode), t);
  return localizeThemeMode(t, 'theme.toolMode.switchHint', `当前是${current}，点一下切到${next}`, { current, next });
}

export function buildThemeToolModeDisabledHint(t?: Translate) {
  return localizeThemeMode(t, 'theme.toolMode.disabledHint', '换肤工具已关闭，先在工具箱打开换肤。');
}

export function buildThemeToolModeSwitchFeedback(mode: ThemeToolMode, t?: Translate) {
  if (mode === 'off') {
    return localizeThemeMode(t, 'theme.toolMode.feedback.off', '已关闭换肤：之后不会再自动带上换肤工具。');
  }
  if (mode === 'stable') {
    return localizeThemeMode(t, 'theme.toolMode.feedback.stable', '已切回稳态：之后会更稳地换一版全局风格。');
  }
  return localizeThemeMode(t, 'theme.toolMode.feedback.creative', '已切到开放：上限看 AI 能力，也可能有意想不到的后果，长按右侧侧边星星可复活。');
}

export function buildThemeToolModePanelDescription(mode: ThemeToolMode, t?: Translate) {
  if (mode === 'off') {
    return localizeThemeMode(t, 'theme.toolMode.panel.off', '完全关掉换肤工具。之后普通聊天不会再自动滑进换肤，更适合先安静说话。');
  }
  if (mode === 'stable') {
    return localizeThemeMode(t, 'theme.toolMode.panel.stable', '让协作者更稳定地更换整页全局风格，适合先拿到完整、协调、可继续精修的一版。');
  }
  return localizeThemeMode(t, 'theme.toolMode.panel.creative', '把自由度完全交给 AI。上限看 AI 能力，也可能有意想不到的后果，长按右侧侧边星星可复活。');
}

export function shouldShowCreativeModeWarning() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(CREATIVE_MODE_WARNING_SEEN_KEY) !== '1';
}

export function markCreativeModeWarningSeen() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CREATIVE_MODE_WARNING_SEEN_KEY, '1');
}
