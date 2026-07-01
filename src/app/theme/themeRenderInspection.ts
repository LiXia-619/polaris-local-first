import type { ThemeRenderInspectionResult } from '../../engines/toolExecutorTypes';

const INSPECTION_TARGETS = [
  { label: 'app shell', selector: '.app-shell' },
  { label: 'chat world', selector: '.app-shell.chat .world-chat' },
  { label: 'user bubble', selector: '.app-shell.chat .bubble.user' },
  { label: 'assistant reply text', selector: '.app-shell.chat .bubble.assistant' },
  { label: 'composer wrapper', selector: '.app-shell.chat .chat-composer' },
  { label: 'composer box', selector: '.app-shell.chat .chat-box' },
  { label: 'collection world', selector: '.app-shell.collection .world-collection' },
  { label: 'collection card', selector: '.app-shell.collection .code-card' },
  { label: 'collection bottom tabs', selector: '.app-shell.collection .collection-shelf-tabs' },
  { label: 'collection bottom tab item', selector: '.app-shell.collection .shelf-tab' },
  { label: 'top bar', selector: '.app-shell .topbar-surface' },
  { label: 'top bar identity', selector: '.app-shell .topbar .world-anchor' },
  { label: 'tool receipt', selector: '.app-shell.chat .tool-event' },
  { label: 'tool receipt icon', selector: '.app-shell.chat .tool-event-icon' },
  { label: 'code detail head', selector: '.app-shell.chat .message-code-drawer-head' }
] as const;

const STYLE_PROPERTIES = [
  'background-color',
  'background-image',
  'color',
  'border-color',
  'border-radius',
  'box-shadow',
  'opacity',
  'backdrop-filter'
] as const;

function formatValue(value: string) {
  return value && value !== 'none' ? value : 'none';
}

function inspectElement(target: (typeof INSPECTION_TARGETS)[number]) {
  const element = document.querySelector<HTMLElement>(target.selector);
  if (!element) {
    return `${target.label} · ${target.selector}\nmissing · 当前世界没有挂载这个元素时会这样；这不代表 selector 写错。`;
  }
  const styles = window.getComputedStyle(element);
  return [
    `${target.label} · ${target.selector}`,
    ...STYLE_PROPERTIES.map((property) => `${property}: ${formatValue(styles.getPropertyValue(property).trim())}`)
  ].join('\n');
}

export function inspectCurrentThemeRender(): ThemeRenderInspectionResult {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { ok: false, error: '当前环境没有 DOM，无法检查主题渲染。' };
  }
  return {
    ok: true,
    detailText: [
      '当前主题渲染检查',
      `world=${document.body.dataset.polarisWorld ?? 'unknown'}`,
      `preset=${document.body.dataset.polarisPreset ?? 'custom'}`,
      '',
      ...INSPECTION_TARGETS.map(inspectElement).flatMap((block) => [block, ''])
    ].join('\n').trim()
  };
}
