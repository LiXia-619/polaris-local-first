import type { ThemeToolScope } from '../../types/domain';
import type { ThemeCoordinatePreview } from './themeCoordinateSpaceMapping';
import { cssBlock, isPrototypeFamily, usesMaterialRecessedMorphology } from './themeCoordinateStableRuleShared';

export function buildCardRules(preview: ThemeCoordinatePreview) {
  const spec = preview.surfaceSpecs.card;
  const woodRaised = isPrototypeFamily(preview, 'grain-wood');
  const cardRule = cssBlock('collection-card', [
    `border-width: ${spec.borderWidth === '0px' ? '0' : spec.borderWidth};`,
    `border-color: ${spec.borderWidth === '0px' ? 'transparent' : preview.styleVars['--collection-card-border-color'] ?? spec.accent};`,
    `border-radius: ${spec.radius};`,
    `box-shadow: ${preview.styleVars['--collection-card-shadow'] ?? spec.shadow};`,
    `backdrop-filter: blur(${spec.blur});`
  ].join('\n'));
  const buttonRule = cssBlock('collection-button', [
    `color: ${preview.styleVars['--collection-card-text-soft'] ?? spec.text};`,
    `border-color: ${woodRaised ? 'transparent' : `color-mix(in srgb, ${preview.styleVars['--collection-card-border'] ?? spec.accent} 74%, transparent)`};`,
    `background: ${woodRaised
      ? `color-mix(in srgb, ${preview.styleVars['--collection-card-fill'] ?? spec.fill} 86%, rgba(255,255,255,0.05))`
      : `color-mix(in srgb, ${preview.styleVars['--collection-card-surface'] ?? spec.fill} 82%, transparent)`};`,
    `box-shadow: ${woodRaised
      ? `inset 0 1px 0 rgba(255,255,255,0.14)`
      : 'none'};`
  ].join('\n'));
  const dialogueActionRule = cssBlock('collection-dialogue-actions', [
    `color: ${preview.styleVars['--collection-card-text-soft'] ?? spec.text};`,
    `border-color: ${woodRaised ? 'transparent' : `color-mix(in srgb, ${preview.styleVars['--collection-card-border-hover'] ?? spec.accent} 76%, transparent)`};`,
    `background: ${woodRaised
      ? `color-mix(in srgb, ${preview.styleVars['--collection-card-fill'] ?? spec.fill} 88%, rgba(255,255,255,0.04))`
      : 'transparent'};`,
    `box-shadow: ${woodRaised
      ? `inset 0 1px 0 rgba(255,255,255,0.14)`
      : 'none'};`
  ].join('\n'));
  return [cardRule, buttonRule, dialogueActionRule].filter(Boolean).join('\n');
}

export function buildCardFaceRules(preview: ThemeCoordinatePreview) {
  const spec = preview.surfaceSpecs.card;
  const borderless = spec.borderWidth === '0px';
  const woodRaised = isPrototypeFamily(preview, 'grain-wood');
  return [
    '.app-shell.collection {\n'
      + [
        `--card-bg: ${preview.styleVars['--card-bg'] ?? spec.fill};`,
        `--collection-card-fill: ${preview.styleVars['--collection-card-fill'] ?? preview.styleVars['--card-bg'] ?? spec.fill};`,
        `--collection-card-background: ${preview.styleVars['--collection-card-background'] ?? spec.fill};`,
        `--collection-card-border-color: ${borderless ? 'transparent' : preview.styleVars['--collection-card-border-color'] ?? spec.accent};`,
        `--collection-card-shadow: ${preview.styleVars['--collection-card-shadow'] ?? spec.shadow};`,
        `--collection-workshop-panel-fill: ${preview.styleVars['--collection-card-background'] ?? spec.fill};`,
        `--collection-workshop-panel-border: ${borderless ? '0' : `1px solid ${preview.styleVars['--collection-card-border-color'] ?? spec.accent}`};`,
        `--collection-workshop-panel-shadow: ${preview.styleVars['--collection-card-shadow'] ?? spec.shadow};`,
        `--code-workshop-sheet-base-fill: ${preview.styleVars['--collection-card-fill'] ?? preview.styleVars['--card-bg'] ?? spec.fill};`,
        `--code-workshop-sheet-fill: ${preview.styleVars['--collection-card-background'] ?? spec.fill};`,
        `--code-workshop-sheet-border: ${borderless ? '0' : `1px solid ${preview.styleVars['--collection-card-border-color'] ?? spec.accent}`};`,
        `--code-workshop-sheet-shadow: ${preview.styleVars['--collection-card-shadow'] ?? spec.shadow};`,
        `--code-workshop-board-fill: ${preview.styleVars['--collection-card-background'] ?? spec.fill};`,
        `--code-workshop-board-border: ${borderless ? '0' : `1px solid ${preview.styleVars['--collection-card-border-color'] ?? spec.accent}`};`
      ].join('\n')
      + '\n}',
    cssBlock('collection-card', [
      `background: ${woodRaised
        ? preview.styleVars['--collection-card-fill'] ?? spec.fill
        : preview.styleVars['--collection-card-background'] ?? spec.fill};`,
      `border-width: ${borderless ? '0' : spec.borderWidth};`,
      `border-color: ${borderless ? 'transparent' : preview.styleVars['--collection-card-border-color'] ?? spec.accent};`,
      `box-shadow: ${preview.styleVars['--collection-card-shadow'] ?? spec.shadow};`,
      `backdrop-filter: blur(${spec.blur});`
    ].join('\n'))
  ].filter(Boolean).join('\n');
}

export function buildWoodFurnitureRules(scope: ThemeToolScope, preview: ThemeCoordinatePreview) {
  if (!isPrototypeFamily(preview, 'grain-wood')) return '';

  const topbar = preview.surfaceSpecs.topbar;
  const card = preview.surfaceSpecs.card;
  const composer = preview.surfaceSpecs.composer;
  const quietRailFill = `color-mix(in srgb, ${topbar.fill} 82%, rgba(255,255,255,0.08))`;
  const quietControlFill = `color-mix(in srgb, ${card.fill} 92%, rgba(255,255,255,0.08))`;
  const quietControlFillSoft = `color-mix(in srgb, ${card.fill} 84%, rgba(255,255,255,0.06))`;
  const engravedLine = `color-mix(in srgb, ${card.text} 10%, rgba(120, 95, 70, 0.12))`;
  const engravedText = `color-mix(in srgb, ${card.text} 78%, ${card.muted} 22%)`;
  const railShadow = 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(130, 101, 71, 0.14)';
  const controlShadow = 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(130, 101, 71, 0.1)';
  const railBorder = `1px solid color-mix(in srgb, ${card.text} 8%, rgba(120, 95, 70, 0.16))`;

  if (scope === 'chat') {
    return [
      cssBlock('.app-shell.chat .topbar .topbar-main', [
        'padding: 7px 10px;',
        'border-radius: 20px;',
        `background: ${quietRailFill};`,
        `border: ${railBorder};`,
        `box-shadow: ${railShadow};`
      ].join('\n')),
      cssBlock('.app-shell.chat .active-preview-strip', [
        `border: ${railBorder};`,
        'border-radius: 18px;',
        `background: ${quietRailFill};`,
        `box-shadow: ${railShadow};`,
        'backdrop-filter: none;'
      ].join('\n')),
      cssBlock('.app-shell.chat .micro-action-btn, .app-shell.chat .user-bubble-action-btn, .app-shell.chat .chat-jump-latest-btn', [
        `border: ${railBorder};`,
        'border-radius: 12px;',
        `background: ${quietControlFill};`,
        `box-shadow: ${controlShadow};`,
        `color: ${engravedText};`,
        'backdrop-filter: none;'
      ].join('\n')),
      cssBlock('.app-shell.chat .micro-action-btn:hover, .app-shell.chat .micro-action-btn:focus-visible, .app-shell.chat .user-bubble-action-btn:hover, .app-shell.chat .user-bubble-action-btn:focus-visible, .app-shell.chat .chat-jump-latest-btn:hover, .app-shell.chat .chat-jump-latest-btn:focus-visible', [
        'transform: none;',
        `border-color: ${engravedLine};`,
        `background: ${quietControlFillSoft};`,
        `color: ${card.text};`,
        `box-shadow: ${controlShadow};`
      ].join('\n')),
      cssBlock('.app-shell.chat .chat-box:focus-within, .app-shell.chat .composer-slot-btn:hover, .app-shell.chat .composer-slot-btn:focus-visible, .app-shell.chat .send-btn.has-content:hover, .app-shell.chat .send-btn.has-content:focus-visible', 'transform: none;'),
      cssBlock('.app-shell.chat .chat-box', [
        'backdrop-filter: none;',
        `background: ${composer.fill};`,
        `border: ${railBorder};`,
        `box-shadow: ${railShadow};`
      ].join('\n')),
      cssBlock('.app-shell.chat .composer-slot-btn, .app-shell.chat .send-btn', [
        `background: ${quietControlFill};`,
        `border: ${railBorder};`,
        'border-radius: 12px;',
        `box-shadow: ${controlShadow};`
      ].join('\n'))
    ].filter(Boolean).join('\n');
  }

  if (scope === 'collection') {
    return [
      '.app-shell.collection {\n'
        + [
          `--collection-dialogue-card-background: ${preview.styleVars['--collection-card-fill'] ?? card.fill};`,
          '--collection-dialogue-card-border: 0;',
          '--collection-dialogue-card-hover-transform: none;',
          `--collection-dialogue-card-hover-shadow: ${preview.styleVars['--collection-card-shadow'] ?? card.shadow};`,
          '--collection-dialogue-card-press-transform: translateY(1px) scale(0.997);',
          '--collection-dialogue-card-micro-border: transparent;',
          `--collection-dialogue-card-micro-fill: ${quietControlFill};`,
          `--collection-dialogue-card-micro-hover-border: transparent;`,
          `--collection-dialogue-card-micro-hover-fill: ${quietControlFillSoft};`,
          `--collection-dialogue-card-micro-active-border: transparent;`,
          `--collection-dialogue-card-micro-active-fill: ${quietControlFillSoft};`,
          '--collection-dialogue-card-state-border: 0;',
          `--collection-dialogue-card-state-fill: ${quietControlFill};`,
          `--collection-chip-fill: ${quietControlFill};`,
          `--collection-chip-active-fill: ${quietControlFillSoft};`,
          '--collection-chip-border: transparent;',
          '--collection-chip-active-border: transparent;',
          `--collection-filter-chip-fill: ${quietControlFill};`,
          `--collection-filter-chip-active-fill: ${quietControlFillSoft};`,
          '--collection-filter-chip-border: transparent;',
          '--collection-filter-chip-active-border: transparent;',
          '--collection-search-border: 0;',
          `--collection-search-fill: ${quietRailFill};`,
          `--collection-tab-indicator: ${engravedLine};`,
          '--collection-card-tool-border: 0;',
          `--collection-card-tool-fill: ${quietControlFill};`,
          `--collection-card-tool-primary-border: transparent;`,
          `--collection-card-tool-primary-fill: ${quietControlFillSoft};`,
          `--collection-card-tool-primary-solid-border: transparent;`,
          `--collection-card-tool-primary-solid-fill: ${quietControlFillSoft};`,
          `--collection-card-tool-primary-solid-shadow: ${controlShadow};`,
          `--collection-card-run-dot-border: 0;`,
          `--collection-card-run-dot-fill: ${quietControlFill};`,
          `--collection-card-run-dot-hover-border: transparent;`,
          `--collection-card-run-dot-hover-fill: ${quietControlFillSoft};`
        ].join('\n')
        + '\n}',
      cssBlock('.app-shell.collection .collection-search', [
        `border: ${railBorder};`,
        'border-radius: 20px;',
        `background: ${quietRailFill};`,
        `box-shadow: ${railShadow};`,
        'backdrop-filter: none;'
      ].join('\n')),
      cssBlock('.app-shell.collection .collection-shelf-tabs', 'width: min(100%, 100%);'),
      cssBlock('.app-shell.collection .collection-shelf-tab-row', 'padding: 5px;'),
      cssBlock('.app-shell.collection .chip, .app-shell.collection .chip-add, .app-shell.collection .code-card-composer-tool, .app-shell.collection .micro-action-btn', [
        `border: ${railBorder};`,
        'border-radius: 13px;',
        `background: ${quietControlFill};`,
        `box-shadow: ${controlShadow};`,
        `color: ${engravedText};`
      ].join('\n')),
      cssBlock('.app-shell.collection .chip:hover, .app-shell.collection .chip:focus-visible, .app-shell.collection .chip-add:hover, .app-shell.collection .chip-add:focus-visible, .app-shell.collection .code-card-composer-tool:hover, .app-shell.collection .code-card-composer-tool:focus-visible, .app-shell.collection .micro-action-btn:hover, .app-shell.collection .micro-action-btn:focus-visible', [
        'transform: none;',
        `background: ${quietControlFillSoft};`,
        `box-shadow: ${controlShadow};`,
        `color: ${card.text};`
      ].join('\n')),
      cssBlock('.app-shell.collection .chip.active, .app-shell.collection .quick-skin-row .chip', [
        `background: ${quietControlFillSoft};`,
        `border-color: ${engravedLine};`,
        `box-shadow: ${controlShadow};`,
        `color: ${card.text};`
      ].join('\n')),
      cssBlock('.app-shell.collection .shelf-tab', [
        'border: 0;',
        'background: transparent;',
        'box-shadow: none;',
        `color: ${engravedText};`
      ].join('\n')),
      cssBlock('.app-shell.collection .shelf-tab:hover, .app-shell.collection .shelf-tab:focus-visible', [
        'transform: none;',
        'background: transparent;',
        'box-shadow: none;',
        `color: ${card.text};`
      ].join('\n')),
      cssBlock('.app-shell.collection .shelf-tab.active', [
        'background: transparent;',
        'border-color: transparent;',
        'box-shadow: none;',
        `color: ${card.text};`
      ].join('\n')),
      cssBlock('.app-shell.collection .shelf-tab-icon', [
        'background: transparent;',
        'box-shadow: none;'
      ].join('\n')),
      cssBlock('.app-shell.collection .card.active', 'transform: none;'),
      cssBlock('.app-shell.collection .code-card-run-dot::before', [
        `border: ${railBorder};`,
        `background: ${quietControlFill};`,
        `box-shadow: ${controlShadow};`
      ].join('\n'))
    ].filter(Boolean).join('\n');
  }

  return '';
}

export function buildMaterialRecessedRules(scope: ThemeToolScope, preview: ThemeCoordinatePreview) {
  const card = preview.surfaceSpecs.card;
  if (!usesMaterialRecessedMorphology(preview)) return '';

  const cardShadow = preview.styleVars['--collection-card-shadow'] ?? card.shadow;
  const cardBackground = preview.styleVars['--collection-card-background'] ?? preview.styleVars['--collection-card-fill'] ?? card.fill;

  if (scope !== 'collection') return '';

  return [
    '.app-shell.collection {\n'
      + [
        '--collection-card-active-transform: none;',
        `--collection-dialogue-card-background: ${cardBackground};`,
        `--collection-dialogue-card-shadow: ${cardShadow};`,
        `--collection-dialogue-card-hover-shadow: ${cardShadow};`,
        `--collection-dialogue-card-press-shadow: ${cardShadow};`,
        '--collection-dialogue-card-hover-transform: none;',
        '--collection-dialogue-card-press-transform: translateY(1px) scale(0.998);'
      ].join('\n')
      + '\n}',
    cssBlock('.app-shell.collection .card.active, .app-shell.collection .conversation-card:hover, .app-shell.collection .conversation-card.active', [
      'transform: none;',
      `box-shadow: ${cardShadow};`
    ].join('\n'))
  ].filter(Boolean).join('\n');
}
