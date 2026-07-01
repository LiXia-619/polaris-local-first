import { useEffect } from 'react';
import { getAssetBlob, getAssetMeta } from '../infrastructure/assetStore';
import { CUSTOM_FONT_SCOPES } from '../stores/runtimeStoreCustomization';
import type { AppCustomization, AppDisplayPreferences, CustomFontScope } from '../types/domain';

const CUSTOM_FONT_STYLE_LAYER = 'custom-fonts';
const DISPLAY_PREFERENCE_STYLE_LAYER = 'display-preferences';
const SYSTEM_FONT_STACK = '\'PingFang SC\', \'Hiragino Sans GB\', -apple-system, BlinkMacSystemFont, var(--font-emoji), sans-serif';

const CUSTOM_FONT_SCOPE_SELECTORS: Record<CustomFontScope, string[]> = {
  global: [],
  titles: [
    '.brand h1',
    '.collaborator-info-name-input',
    '.collaborator-overview-card-title-row strong'
  ],
  chat: [
    '.world-chat .bubble',
    '.world-chat .chat-box textarea',
    '.world-chat .assistant-streaming-hint',
    '.world-chat .system-inline-note'
  ],
  cards: [
    '.conversation-card-title-line',
    '.message-code-card-title strong',
    '.message-markdown-card-title',
    '.task-runtime-card-title',
    '.collaborator-scope-card-title'
  ]
};

function escapeCssString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function fontFamilyForAsset(assetId: string) {
  return `Polaris Custom Font ${assetId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function fontFormatFromMimeType(mimeType: string | undefined) {
  const normalized = mimeType?.toLowerCase() ?? '';
  if (normalized.includes('woff2')) return 'woff2';
  if (normalized.includes('woff')) return 'woff';
  if (normalized.includes('opentype') || normalized.includes('otf')) return 'opentype';
  if (normalized.includes('truetype') || normalized.includes('ttf')) return 'truetype';
  return null;
}

function buildFontStack(fontFamily: string) {
  return `"${escapeCssString(fontFamily)}", ${SYSTEM_FONT_STACK}`;
}

function syncCustomFontStyleTag(cssText: string) {
  syncStyleTag(CUSTOM_FONT_STYLE_LAYER, cssText);
}

function syncStyleTag(layer: string, cssText: string) {
  const selector = `style[data-polaris="${layer}"]`;
  const existing = document.head.querySelector<HTMLStyleElement>(selector);
  const styleTag = existing ?? (() => {
    const next = document.createElement('style');
    next.setAttribute('data-polaris', layer);
    document.head.appendChild(next);
    return next;
  })();

  if (styleTag.textContent !== cssText) {
    styleTag.textContent = cssText;
  }
}

function formatScale(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : '1';
}

function buildDisplayPreferenceCss(fontScale: number) {
  const scale = formatScale(fontScale);
  return [
    ':root {',
    `  --polaris-font-scale: ${scale};`,
    `  --type-brand: calc(18px * ${scale});`,
    `  --type-panel-title: calc(20px * ${scale});`,
    `  --type-body: calc(13.5px * ${scale});`,
    `  --type-card-title: calc(12.5px * ${scale});`,
    `  --type-label: calc(12px * ${scale});`,
    `  --type-small: calc(11.5px * ${scale});`,
    `  --type-caption: calc(10.5px * ${scale});`,
    `  --type-micro: calc(10px * ${scale});`,
    `  --type-tag: calc(9.5px * ${scale});`,
    `  --type-tiny: calc(9px * ${scale});`,
    `  --type-code: calc(10px * ${scale});`,
    '}',
    `.world-chat .bubble { font-size: calc(13.5px * ${scale}); }`,
    `.message-code-lines { font-size: calc(12px * ${scale}); }`,
    `.chat-box textarea { font-size: ${fontScale > 1 ? `calc(16px * ${scale})` : '16px'}; }`
  ].join('\n');
}

export function useCustomFontDomEffects(customization: AppCustomization, displayPreferences: AppDisplayPreferences) {
  const assignmentSignature = CUSTOM_FONT_SCOPES
    .map((scope) => `${scope}:${customization.customFontScopeAssignments[scope] ?? ''}`)
    .join('|');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    syncStyleTag(DISPLAY_PREFERENCE_STYLE_LAYER, buildDisplayPreferenceCss(displayPreferences.fontScale));
  }, [displayPreferences.fontScale]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let disposed = false;
    const assignedFontIds = Array.from(new Set(
      CUSTOM_FONT_SCOPES
        .map((scope) => customization.customFontScopeAssignments[scope])
        .filter((assetId): assetId is string => Boolean(assetId))
    ));

    if (assignedFontIds.length === 0) {
      syncCustomFontStyleTag('');
      return undefined;
    }

    const objectUrlsToRevoke: string[] = [];
    const syncFonts = async () => {
      const fontSources = await Promise.all(
        assignedFontIds.map(async (assetId) => {
          const [blob, meta] = await Promise.all([
            getAssetBlob(assetId),
            getAssetMeta(assetId)
          ]);
          return {
            assetId,
            blob,
            meta,
            family: fontFamilyForAsset(assetId)
          };
        })
      );

      if (disposed) return;

      const fontEntries = fontSources.map((source) => {
        const objectUrl = source.blob ? URL.createObjectURL(source.blob) : null;
        if (objectUrl) objectUrlsToRevoke.push(objectUrl);
        return {
          assetId: source.assetId,
          objectUrl,
          family: source.family,
          format: fontFormatFromMimeType(source.meta?.mimeType)
        };
      });

      if (disposed) {
        objectUrlsToRevoke.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
        objectUrlsToRevoke.length = 0;
        return;
      }

      const loadedFonts = new Map(
        fontEntries
          .filter((entry): entry is typeof entry & { objectUrl: string } => Boolean(entry.objectUrl))
          .map((entry) => [entry.assetId, entry])
      );

      const fontFaceCss = Array.from(loadedFonts.values()).map((entry) => {
        const formatHint = entry.format ? ` format("${entry.format}")` : '';
        return [
          '@font-face {',
          `  font-family: "${escapeCssString(entry.family)}";`,
          `  src: url("${escapeCssString(entry.objectUrl)}")${formatHint};`,
          '  font-display: swap;',
          '}'
        ].join('\n');
      });

      const globalFontId = customization.customFontScopeAssignments.global;
      const globalFont = globalFontId ? loadedFonts.get(globalFontId) : null;
      const globalCss = globalFont
        ? [
            ':root {',
            `  --font-ui: ${buildFontStack(globalFont.family)};`,
            '  --font-body: var(--font-ui);',
            '}'
          ].join('\n')
        : '';

      const scopeCss = CUSTOM_FONT_SCOPES.flatMap((scope) => {
        if (scope === 'global') return [];
        const assetId = customization.customFontScopeAssignments[scope];
        const entry = assetId ? loadedFonts.get(assetId) : null;
        if (!entry) return [];
        const selector = CUSTOM_FONT_SCOPE_SELECTORS[scope].join(',\n');
        return [
          `${selector} {\n  font-family: "${escapeCssString(entry.family)}", var(--font-ui);\n}`
        ];
      });

      syncCustomFontStyleTag([...fontFaceCss, globalCss, ...scopeCss].filter(Boolean).join('\n\n'));
    };

    void syncFonts();

    return () => {
      disposed = true;
      objectUrlsToRevoke.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [assignmentSignature]);
}
