import type { ThemeVariables } from '../../types/domain';

export const THEME_PALETTE_KEYS = [
  '--bg',
  '--chat-bg',
  '--cool-bg',
  '--warm-bg',
  '--cool-surface',
  '--warm-surface',
  '--cool-surface-solid',
  '--warm-surface-solid',
  '--cool-surface-deep',
  '--warm-surface-deep',
  '--cool-border',
  '--warm-border',
  '--cool-border-hover',
  '--warm-border-hover',
  '--cool-text',
  '--warm-text',
  '--cool-text-soft',
  '--warm-text-soft',
  '--cool-text-muted',
  '--warm-text-muted',
  '--cool-accent',
  '--warm-accent',
  '--cool-accent-soft',
  '--warm-accent-soft',
  '--cool-accent-glow',
  '--warm-accent-glow',
  '--surface',
  '--surface-solid',
  '--surface-deep',
  '--border',
  '--border-hover',
  '--text',
  '--text-soft',
  '--text-muted',
  '--accent',
  '--accent-soft',
  '--accent-glow',
  '--card-bg',
  '--shadow',
  '--shadow-hover',
  '--shadow-panel',
  '--shadow-bubble',
  '--bubble-user',
  '--bubble-ai',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-2xl',
  '--radius-pill',
  '--radius-panel'
] as const;

export type ThemePaletteKey = (typeof THEME_PALETTE_KEYS)[number];

const COOL_ALIAS_MAP: ReadonlyArray<readonly [ThemePaletteKey, ThemePaletteKey]> = [
  ['--bg', '--chat-bg'],
  ['--bg', '--cool-bg'],
  ['--surface', '--cool-surface'],
  ['--surface-solid', '--cool-surface-solid'],
  ['--surface-deep', '--cool-surface-deep'],
  ['--border', '--cool-border'],
  ['--border-hover', '--cool-border-hover'],
  ['--text', '--cool-text'],
  ['--text-soft', '--cool-text-soft'],
  ['--text-muted', '--cool-text-muted'],
  ['--accent', '--cool-accent'],
  ['--accent-soft', '--cool-accent-soft'],
  ['--accent-glow', '--cool-accent-glow']
];

const WARM_ALIAS_MAP: ReadonlyArray<readonly [ThemePaletteKey, ThemePaletteKey]> = [
  ['--bg', '--warm-bg'],
  ['--surface', '--warm-surface'],
  ['--surface-solid', '--warm-surface-solid'],
  ['--surface-deep', '--warm-surface-deep'],
  ['--border', '--warm-border'],
  ['--border-hover', '--warm-border-hover'],
  ['--text', '--warm-text'],
  ['--text-soft', '--warm-text-soft'],
  ['--text-muted', '--warm-text-muted'],
  ['--accent', '--warm-accent'],
  ['--accent-soft', '--warm-accent-soft'],
  ['--accent-glow', '--warm-accent-glow']
];

function syncAliases(
  variables: ThemeVariables,
  mappings: ReadonlyArray<readonly [ThemePaletteKey, ThemePaletteKey]>
) {
  mappings.forEach(([source, alias]) => {
    if (variables[alias] || !variables[source]) return;
    variables[alias] = variables[source];
  });
}

export function normalizeThemeVariables(input: ThemeVariables): ThemeVariables {
  const normalized: ThemeVariables = {};

  THEME_PALETTE_KEYS.forEach((key) => {
    const value = input[key];
    if (value) {
      normalized[key] = value.trim();
    }
  });

  syncAliases(normalized, COOL_ALIAS_MAP);
  syncAliases(normalized, WARM_ALIAS_MAP);
  return normalized;
}

const DEFAULT_WARM_THEME_VARIABLES = {
  '--warm-bg': 'linear-gradient(180deg, #f7f3ee 0%, #efe8de 100%)',
  '--warm-surface': 'rgba(255, 252, 248, 0.82)',
  '--warm-surface-solid': '#fffaf5',
  '--warm-surface-deep': 'rgba(255, 252, 248, 0.96)',
  '--warm-border': 'rgba(184, 168, 151, 0.22)',
  '--warm-border-hover': 'rgba(184, 168, 151, 0.42)',
  '--warm-text': '#3b3128',
  '--warm-text-soft': '#7d6f62',
  '--warm-text-muted': '#aa9b8c',
  '--warm-accent': '#b68d6b',
  '--warm-accent-soft': 'rgba(182, 141, 107, 0.12)',
  '--warm-accent-glow': 'rgba(182, 141, 107, 0.08)'
} as const satisfies Partial<Record<ThemePaletteKey, string>>;

const DEFAULT_COOL_THEME_VARIABLES = {
  '--chat-bg': 'linear-gradient(168deg, #ffffff 0%, #f4f4f4 42%, #e9e9e9 100%)',
  '--cool-bg': 'linear-gradient(168deg, #ffffff 0%, #f4f4f4 42%, #e9e9e9 100%)',
  '--cool-surface': 'rgba(255, 255, 255, 0.72)',
  '--cool-surface-solid': '#ffffff',
  '--cool-surface-deep': 'rgba(245, 245, 245, 0.92)',
  '--cool-border': 'rgba(17, 17, 17, 0.08)',
  '--cool-border-hover': 'rgba(17, 17, 17, 0.22)',
  '--cool-text': '#111111',
  '--cool-text-soft': '#5d5d5d',
  '--cool-text-muted': '#989898',
  '--cool-accent': '#1a1a1a',
  '--cool-accent-soft': 'rgba(17, 17, 17, 0.08)',
  '--cool-accent-glow': 'rgba(17, 17, 17, 0.1)'
} as const satisfies Partial<Record<ThemePaletteKey, string>>;

export const CUSTOM_THEME_BASE_VARIABLES: Record<ThemePaletteKey, string> = {
  '--bg': 'linear-gradient(180deg, #f7f3ee 0%, #efe8de 100%)',
  ...DEFAULT_WARM_THEME_VARIABLES,
  ...DEFAULT_COOL_THEME_VARIABLES,
  '--surface': 'rgba(255, 252, 248, 0.82)',
  '--surface-solid': '#fffaf5',
  '--surface-deep': 'rgba(255, 252, 248, 0.96)',
  '--border': 'rgba(184, 168, 151, 0.22)',
  '--border-hover': 'rgba(184, 168, 151, 0.42)',
  '--text': '#3b3128',
  '--text-soft': '#7d6f62',
  '--text-muted': '#aa9b8c',
  '--accent': '#b68d6b',
  '--accent-soft': 'rgba(182, 141, 107, 0.12)',
  '--accent-glow': 'rgba(182, 141, 107, 0.08)',
  '--card-bg': 'linear-gradient(135deg, rgba(255,250,246,0.94) 0%, rgba(247,240,233,0.92) 100%)',
  '--shadow': '0 8px 24px rgba(138, 112, 88, 0.08), 0 0 0 1px rgba(184, 168, 151, 0.12)',
  '--shadow-hover': '0 16px 36px rgba(138, 112, 88, 0.12), 0 0 0 1px rgba(184, 168, 151, 0.2)',
  '--shadow-panel': '0 12px 34px rgba(17, 17, 17, 0.1)',
  '--shadow-bubble': '0 2px 10px rgba(17, 17, 17, 0.05)',
  '--bubble-user': 'linear-gradient(135deg, rgba(24, 24, 24, 0.12) 0%, rgba(24, 24, 24, 0.04) 100%)',
  '--bubble-ai': 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(241, 241, 241, 0.94) 100%)',
  '--radius-sm': '9px',
  '--radius-md': '11px',
  '--radius-lg': '14px',
  '--radius-xl': '16px',
  '--radius-2xl': '18px',
  '--radius-pill': '20px',
  '--radius-panel': '24px'
};

export const PURE_CANVAS_THEME_VARIABLES: Record<ThemePaletteKey, string> = {
  '--bg': 'linear-gradient(180deg, #fcfaf6 0%, #f5f1ea 100%)',
  '--warm-bg': 'linear-gradient(180deg, #fcfaf6 0%, #f5f1ea 100%)',
  ...DEFAULT_COOL_THEME_VARIABLES,
  '--surface': 'rgba(255, 255, 252, 0.9)',
  '--warm-surface': 'rgba(255, 255, 252, 0.9)',
  '--surface-solid': '#fffdfa',
  '--warm-surface-solid': '#fffdfa',
  '--surface-deep': 'rgba(255, 255, 252, 0.98)',
  '--warm-surface-deep': 'rgba(255, 255, 252, 0.98)',
  '--border': 'rgba(160, 150, 138, 0.14)',
  '--warm-border': 'rgba(160, 150, 138, 0.14)',
  '--border-hover': 'rgba(160, 150, 138, 0.26)',
  '--warm-border-hover': 'rgba(160, 150, 138, 0.26)',
  '--text': '#302b25',
  '--warm-text': '#302b25',
  '--text-soft': '#6f665d',
  '--warm-text-soft': '#6f665d',
  '--text-muted': '#9e9488',
  '--warm-text-muted': '#9e9488',
  '--accent': '#bca27d',
  '--warm-accent': '#bca27d',
  '--accent-soft': 'rgba(188, 162, 125, 0.08)',
  '--warm-accent-soft': 'rgba(188, 162, 125, 0.08)',
  '--accent-glow': 'rgba(188, 162, 125, 0.04)',
  '--warm-accent-glow': 'rgba(188, 162, 125, 0.04)',
  '--card-bg': 'linear-gradient(180deg, rgba(255,255,253,0.98) 0%, rgba(249,244,237,0.94) 100%)',
  '--shadow': '0 8px 22px rgba(112, 100, 86, 0.05)',
  '--shadow-hover': '0 16px 36px rgba(112, 100, 86, 0.08)',
  '--shadow-panel': '0 10px 28px rgba(17, 17, 17, 0.06)',
  '--shadow-bubble': '0 2px 8px rgba(17, 17, 17, 0.04)',
  '--bubble-user': 'linear-gradient(135deg, rgba(24, 24, 24, 0.1) 0%, rgba(24, 24, 24, 0.03) 100%)',
  '--bubble-ai': 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,247,251,0.94) 100%)',
  '--radius-sm': '8px',
  '--radius-md': '10px',
  '--radius-lg': '14px',
  '--radius-xl': '16px',
  '--radius-2xl': '18px',
  '--radius-pill': '20px',
  '--radius-panel': '24px'
};
