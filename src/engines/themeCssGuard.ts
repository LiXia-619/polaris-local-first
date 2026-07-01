export type ThemeCssGuardResult = {
  mode: 'empty' | 'variables' | 'experimental';
  blockingIssues: string[];
  warnings: string[];
};

const CSS_VARIABLE_ONLY_PATTERN = /^\s*(--[\w-]+\s*:\s*[^;]+;?\s*)+$/;
const REMOTE_URL_PATTERN = /url\(\s*(['"]?)((?:https?:)?\/\/[^'")\s]+)\1\s*\)/i;
const REMOTE_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?['"]?(?:https?:)?\/\//i;
const REMOTE_IMPORT_BLOCK_MESSAGE = '主题 CSS 不能用 @import 引入远程样式；请把需要的规则直接写进这里。';
const REMOTE_ASSET_WARNING_MESSAGE = '主题 CSS 使用了外链资源；离线或图床失效时，对应图片或字体可能不显示。';

export function analyzeThemeCustomCss(cssText: string): ThemeCssGuardResult {
  const css = cssText.trim();
  if (!css) {
    return { mode: 'empty', blockingIssues: [], warnings: [] };
  }

  if (CSS_VARIABLE_ONLY_PATTERN.test(css.replace(/\n/g, ' '))) {
    return { mode: 'variables', blockingIssues: [], warnings: [] };
  }

  if (REMOTE_IMPORT_PATTERN.test(css)) {
    return {
      mode: 'experimental',
      blockingIssues: [REMOTE_IMPORT_BLOCK_MESSAGE],
      warnings: []
    };
  }

  return {
    mode: 'experimental',
    blockingIssues: [],
    warnings: REMOTE_URL_PATTERN.test(css) ? [REMOTE_ASSET_WARNING_MESSAGE] : []
  };
}
