import { buildCustomThemeFrame } from '../config/theme/themePresets';
import type { ThemeFrame } from '../types/domain';
import { buildThemeBlankBaseCss } from './themeBlankBaseCss';
import { analyzeThemeCustomCss } from './themeCssGuard';
import { readSimpleCssRules } from './themeCssRuleMerge';

export type ThemeCssFileLayer = 'custom' | 'generated';

export type ThemeCssEditResult =
  | {
      ok: true;
      nextTheme: ThemeFrame;
      layer: ThemeCssFileLayer;
      matchOffset: number;
      writtenCss?: string;
    }
  | {
      ok: false;
      error: string;
    };

const HEADER = [
  '/*',
  'Polaris virtual theme.css',
  'Cascade order: blank-base -> preset -> custom -> generated.',
  'blank-base and preset show the current base. Edit custom or generated with editThemeCss / appendThemeCss / insertThemeCss / deleteThemeCss.',
  'Use replaceThemeCss for a full independent skin that clears preset and writes a complete custom CSS file.',
  '*/'
].join('\n');

function layerBlock(layer: string, access: 'readonly' | 'writable', css: string) {
  return [
    `/* @polaris-layer ${layer} ${access} */`,
    css.trim() || `/* ${layer} is empty */`,
    `/* @end-polaris-layer ${layer} */`
  ].join('\n');
}

export function serializeThemeCssFile(theme: ThemeFrame) {
  return [
    HEADER,
    layerBlock('blank-base', 'readonly', buildThemeBlankBaseCss()),
    layerBlock(
      `preset${theme.activePresetId ? ` id=${theme.activePresetId}` : ''}`,
      'readonly',
      theme.presetCSS
    ),
    layerBlock('custom', 'writable', theme.customCSS),
    layerBlock('generated', 'writable', theme.generatedCSS)
  ].join('\n\n');
}

function countStringOccurrences(source: string, needle: string) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (index <= source.length) {
    const nextIndex = source.indexOf(needle, index);
    if (nextIndex === -1) break;
    count += 1;
    index = nextIndex + needle.length;
  }
  return count;
}

function resolveWritableLayer(
  theme: ThemeFrame,
  oldString: string,
  requestedLayer?: ThemeCssFileLayer
): ThemeCssFileLayer | { error: string } {
  if (requestedLayer) {
    const source = requestedLayer === 'custom' ? theme.customCSS : theme.generatedCSS;
    const matches = countStringOccurrences(source, oldString);
    if (matches === 0) {
      return { error: `没有在 ${requestedLayer} 层找到要替换的 CSS 片段。` };
    }
    if (matches > 1) {
      return { error: `${requestedLayer} 层里匹配到 ${matches} 处，请提供更长的 oldString。` };
    }
    return requestedLayer;
  }

  const customMatches = countStringOccurrences(theme.customCSS, oldString);
  const generatedMatches = countStringOccurrences(theme.generatedCSS, oldString);
  const totalWritableMatches = customMatches + generatedMatches;
  if (totalWritableMatches === 1) {
    return customMatches === 1 ? 'custom' : 'generated';
  }
  if (totalWritableMatches > 1) {
    return { error: `可写主题层里匹配到 ${totalWritableMatches} 处，请指定 layer 或提供更长的 oldString。` };
  }

  if (theme.presetCSS.includes(oldString) || buildThemeBlankBaseCss().includes(oldString)) {
    return { error: '这个片段来自只读底座。局部调整请在 custom/generated 层追加或修改；完整换肤请用 replaceThemeCss。' };
  }

  return { error: '没有找到要替换的 CSS 片段。请读取最新 theme.css，或使用最近一次 readThemeCss 返回的原文精确替换。' };
}

function updateWritableLayer(theme: ThemeFrame, layer: ThemeCssFileLayer, nextSource: string) {
  const guard = analyzeThemeCustomCss(nextSource);
  if (guard.blockingIssues.length > 0) {
    return { ok: false as const, error: guard.blockingIssues[0]! };
  }
  return {
    ok: true as const,
    nextTheme: {
      ...theme,
      activeSavedSkinId: null,
      customCSS: layer === 'custom' ? nextSource : theme.customCSS,
      generatedCSS: layer === 'generated' ? nextSource : theme.generatedCSS
    }
  };
}

function wrapVariableDeclarations(css: string) {
  const declarations = css
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.endsWith(';') ? line : `${line};`)
    .map((line) => `  ${line}`)
    .join('\n');

  return `.app-shell {\n${declarations}\n}`;
}

function normalizeWritableCssInput(css: string) {
  const trimmed = css.trim();
  if (!trimmed) {
    return { ok: false as const, error: '主题 CSS 缺少内容。' };
  }

  const guard = analyzeThemeCustomCss(trimmed);
  if (guard.blockingIssues.length > 0) {
    return { ok: false as const, error: guard.blockingIssues[0]! };
  }

  if (guard.mode === 'variables') {
    return { ok: true as const, css: wrapVariableDeclarations(trimmed) };
  }

  if (!readSimpleCssRules(trimmed)) {
    return {
      ok: false as const,
      error: '这段 CSS 还不是浏览器能直接应用的规则。请写成 `selector { property: value; }`，不要只写 selector 列表或裸声明。'
    };
  }

  return { ok: true as const, css: trimmed };
}

export function editThemeCssFile(args: {
  theme: ThemeFrame;
  oldString: string;
  newString: string;
  layer?: ThemeCssFileLayer;
}): ThemeCssEditResult {
  if (!args.oldString) {
    return { ok: false, error: 'editThemeCss 缺少 oldString。' };
  }
  const layer = resolveWritableLayer(args.theme, args.oldString, args.layer);
  if (typeof layer !== 'string') return { ok: false, error: layer.error };

  const source = layer === 'custom' ? args.theme.customCSS : args.theme.generatedCSS;
  const matchOffset = source.indexOf(args.oldString);
  const nextSource = source.replace(args.oldString, args.newString);
  const updateResult = updateWritableLayer(args.theme, layer, nextSource);
  if (!updateResult.ok) return updateResult;
  return {
    ok: true,
    layer,
    matchOffset,
    nextTheme: updateResult.nextTheme
  };
}

export function appendThemeCssFile(args: {
  theme: ThemeFrame;
  css: string;
  layer?: ThemeCssFileLayer;
}): ThemeCssEditResult {
  const css = args.css.trim();
  if (!css) {
    return { ok: false, error: 'appendThemeCss 缺少 CSS。' };
  }
  const normalizedCss = normalizeWritableCssInput(css);
  if (!normalizedCss.ok) return normalizedCss;
  const layer = args.layer ?? 'generated';
  const source = layer === 'custom' ? args.theme.customCSS : args.theme.generatedCSS;
  const nextSource = [source.trim(), normalizedCss.css].filter(Boolean).join('\n\n');
  const updateResult = updateWritableLayer(args.theme, layer, nextSource);
  if (!updateResult.ok) return updateResult;
  return {
    ok: true,
    layer,
    matchOffset: source.length,
    nextTheme: updateResult.nextTheme,
    writtenCss: normalizedCss.css
  };
}

export function insertThemeCssFile(args: {
  theme: ThemeFrame;
  anchorString: string;
  css: string;
  position?: 'before' | 'after';
  layer?: ThemeCssFileLayer;
}): ThemeCssEditResult {
  const css = args.css.trim();
  if (!css) {
    return { ok: false, error: 'insertThemeCss 缺少 CSS。' };
  }
  const normalizedCss = normalizeWritableCssInput(css);
  if (!normalizedCss.ok) return normalizedCss;
  if (!args.anchorString) {
    return { ok: false, error: 'insertThemeCss 缺少 anchorString。想追加到末尾请用 appendThemeCss。' };
  }
  const layer = resolveWritableLayer(args.theme, args.anchorString, args.layer);
  if (typeof layer !== 'string') return { ok: false, error: layer.error };

  const source = layer === 'custom' ? args.theme.customCSS : args.theme.generatedCSS;
  const matchOffset = source.indexOf(args.anchorString);
  const insertOffset = args.position === 'before'
    ? matchOffset
    : matchOffset + args.anchorString.length;
  const spacerBefore = insertOffset > 0 && !source.slice(0, insertOffset).endsWith('\n') ? '\n\n' : '';
  const spacerAfter = insertOffset < source.length && !source.slice(insertOffset).startsWith('\n') ? '\n\n' : '';
  const nextSource = [
    source.slice(0, insertOffset),
    spacerBefore,
    normalizedCss.css,
    spacerAfter,
    source.slice(insertOffset)
  ].join('');
  const updateResult = updateWritableLayer(args.theme, layer, nextSource);
  if (!updateResult.ok) return updateResult;
  return {
    ok: true,
    layer,
    matchOffset,
    nextTheme: updateResult.nextTheme,
    writtenCss: normalizedCss.css
  };
}

export function deleteThemeCssFile(args: {
  theme: ThemeFrame;
  oldString: string;
  layer?: ThemeCssFileLayer;
}): ThemeCssEditResult {
  return editThemeCssFile({
    theme: args.theme,
    oldString: args.oldString,
    newString: '',
    layer: args.layer
  });
}

export function replaceThemeCssFile(css: string): ThemeCssEditResult {
  if (!css.trim()) {
    return { ok: false, error: 'replaceThemeCss 缺少完整 CSS。' };
  }
  const normalizedCss = normalizeWritableCssInput(css);
  if (!normalizedCss.ok) return normalizedCss;
  return {
    ok: true,
    layer: 'custom',
    matchOffset: 0,
    writtenCss: normalizedCss.css,
    nextTheme: {
      ...buildCustomThemeFrame(),
      customCSS: normalizedCss.css
    }
  };
}
