import { modelTierLabel } from '../../engines/modelTier';
import type { AssistantToolContext } from './assistantToolProtocolTypes';

function summarizeCssLayer(label: string, cssText: string) {
  const compact = cssText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' ');
  return compact ? `${label}：${compact.slice(0, 240)}` : `${label}：空`;
}

function describeThemeToolMode(mode: AssistantToolContext['themeToolMode']) {
  if (mode === 'stable') return '稳定模式';
  if (mode === 'creative') return '创意模式';
  if (mode === 'off') return '换肤关闭';
  return '';
}

function buildThemeModeSwitchLine(context: AssistantToolContext | undefined) {
  const hint = context?.themeModeSwitchHint;
  if (!hint) return '';
  const from = describeThemeToolMode(hint.from);
  const to = describeThemeToolMode(hint.to);
  if (!from || !to || from === to) return '';
  return `刚刚换挡：上一轮还是${from}，这轮已经切到${to}。不要延续上一轮的输出协议，直接按当前模式执行。`;
}

export function buildSharedThemeRuleLines() {
  return [
    '- 用户点名的范围是主要目标；背景、顶栏、气泡、输入区之间的关系用于保持整体协调。',
    '- 正文说体感和落点，代码和参数留给工具。'
  ];
}

export function buildThemeSnapshotPrompt(context: AssistantToolContext | undefined): string {
  const themeContextMode = context?.themeContextMode ?? 'summary';
  const modeSwitchLine = buildThemeModeSwitchLine(context);
  if (themeContextMode === 'none' && !modeSwitchLine) return '';
  const theme = context?.themeSnapshot;
  if (!theme && !modeSwitchLine) return '';
  const lines = [
    modeSwitchLine,
    '当前主题摘要：这是用户眼前正在看的样子。',
    `模式：${context?.themePreviewActive ? '正在试穿' : '正常'}${context?.themeToolMode ? ` · ${describeThemeToolMode(context.themeToolMode)}` : ''}${context?.modelTier ? ` · ${modelTierLabel(context.modelTier)}` : ''}`,
    theme ? `底座：${theme.activePresetId ?? '纯自定义底座'}${theme.activeSavedSkinId ? ` · saved=${theme.activeSavedSkinId}` : ''}` : ''
  ].filter(Boolean);
  if (themeContextMode === 'focused' && theme) {
    lines.push(
      summarizeCssLayer('presetCSS', theme.presetCSS),
      summarizeCssLayer('customCSS', theme.customCSS),
      summarizeCssLayer('surfaceOverlayCSS', theme.generatedCSS)
    );
  }
  return lines.join('\n');
}
