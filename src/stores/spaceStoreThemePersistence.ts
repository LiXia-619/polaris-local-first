import { buildThemeFrameFromPresetId, DEFAULT_THEME_PRESET_ID } from '../config/theme/themePresets';
import { normalizeThemeVariables } from '../config/theme/themePresetVariables';
import {
  areThemeVariablesEqual,
  createInitialThemeState,
  normalizeSelectedSurfaceCodes,
  resolveSavedSkinId
} from './spaceStoreTheme';
import type {
  SavedSkin,
  SkinSnapshot,
  ThemePatchLayer,
  ThemePatchLedgerEntry,
  ThemePatchLedgerStatus,
  ThemeRecipeMeta,
  ThemeState,
  ThemeToolPatchMode,
  ThemeToolScope,
  ThemeToolMode,
  ThemeVariables
} from '../types/domain';

const HISTORY_LIMIT = 15;
const LEGACY_POLARIS_DEFAULT_THEME_VARIABLES = normalizeThemeVariables({
  '--bg': 'linear-gradient(165deg, #fbf7f2 0%, #f5ede3 40%, #f0e6d8 100%)',
  '--surface': 'rgba(255, 252, 248, 0.72)',
  '--surface-solid': '#fffcf8',
  '--surface-deep': 'rgba(255, 252, 248, 0.9)',
  '--border': 'rgba(205, 185, 160, 0.25)',
  '--border-hover': 'rgba(205, 185, 160, 0.45)',
  '--text': '#3d3228',
  '--text-soft': '#8a7c6e',
  '--text-muted': '#b5a898',
  '--accent': '#c4956a',
  '--accent-soft': 'rgba(196, 149, 106, 0.12)',
  '--accent-glow': 'rgba(196, 149, 106, 0.06)',
  '--card-bg': 'linear-gradient(135deg, rgba(255,252,248,0.92) 0%, rgba(250,244,236,0.9) 100%)',
  '--shadow': '0 2px 20px rgba(160, 130, 100, 0.06), 0 0 0 1px rgba(205, 185, 160, 0.12)',
  '--shadow-hover': '0 8px 32px rgba(160, 130, 100, 0.1), 0 0 0 1px rgba(205, 185, 160, 0.2)',
  '--shadow-panel': '0 12px 28px rgba(160, 130, 100, 0.08)',
  '--chat-bg': 'linear-gradient(165deg, #f4f5fa 0%, #eceef6 40%, #e5e8f2 100%)',
  '--cool-bg': 'linear-gradient(165deg, #f4f5fa 0%, #eceef6 40%, #e5e8f2 100%)',
  '--cool-surface': 'rgba(248, 249, 253, 0.72)',
  '--cool-surface-solid': '#f8f9fd',
  '--cool-surface-deep': 'rgba(248, 249, 253, 0.9)',
  '--cool-border': 'rgba(170, 178, 205, 0.25)',
  '--cool-border-hover': 'rgba(170, 178, 205, 0.45)',
  '--cool-text': '#282d3d',
  '--cool-text-soft': '#6e7490',
  '--cool-text-muted': '#9ba1b8',
  '--cool-accent': '#7b8abf',
  '--cool-accent-soft': 'rgba(123, 138, 191, 0.12)',
  '--cool-accent-glow': 'rgba(123, 138, 191, 0.06)',
  '--bubble-user': 'linear-gradient(135deg, rgba(123,138,191,0.12) 0%, rgba(123,138,191,0.06) 100%)',
  '--bubble-ai': 'linear-gradient(135deg, rgba(248,249,253,0.9) 0%, rgba(243,245,252,0.9) 100%)'
});

const WARM_ROOM_POLARIS_DEFAULT_THEME_VARIABLES = normalizeThemeVariables({
  '--bg': 'linear-gradient(165deg, #fbf7f2 0%, #f5ede3 40%, #f0e6d8 100%)',
  '--surface': 'rgba(255, 252, 248, 0.72)',
  '--surface-solid': '#fffcf8',
  '--surface-deep': 'rgba(255, 252, 248, 0.9)',
  '--border': 'rgba(205, 185, 160, 0.25)',
  '--border-hover': 'rgba(205, 185, 160, 0.45)',
  '--text': '#3d3228',
  '--text-soft': '#8a7c6e',
  '--text-muted': '#b5a898',
  '--accent': '#c4956a',
  '--accent-soft': 'rgba(196, 149, 106, 0.12)',
  '--accent-glow': 'rgba(196, 149, 106, 0.06)',
  '--card-bg': 'linear-gradient(135deg, rgba(255,252,248,0.92) 0%, rgba(250,244,236,0.9) 100%)',
  '--shadow': '0 2px 20px rgba(160, 130, 100, 0.06), 0 0 0 1px rgba(205, 185, 160, 0.12)',
  '--shadow-hover': '0 8px 32px rgba(160, 130, 100, 0.1), 0 0 0 1px rgba(205, 185, 160, 0.2)',
  '--shadow-panel': '0 12px 28px rgba(17, 17, 17, 0.08)',
  '--chat-bg': 'linear-gradient(168deg, #ffffff 0%, #f4f4f4 42%, #e9e9e9 100%)',
  '--cool-bg': 'linear-gradient(168deg, #ffffff 0%, #f4f4f4 42%, #e9e9e9 100%)',
  '--cool-surface': 'rgba(255, 255, 255, 0.74)',
  '--cool-surface-solid': '#ffffff',
  '--cool-surface-deep': 'rgba(245, 245, 245, 0.92)',
  '--cool-border': 'rgba(17, 17, 17, 0.08)',
  '--cool-border-hover': 'rgba(17, 17, 17, 0.22)',
  '--cool-text': '#1a1a1a',
  '--cool-text-soft': '#5d5d5d',
  '--cool-text-muted': '#999999',
  '--cool-accent': '#1a1a1a',
  '--cool-accent-soft': 'rgba(17, 17, 17, 0.08)',
  '--cool-accent-glow': 'rgba(17, 17, 17, 0.08)',
  '--bubble-user': 'linear-gradient(135deg, rgba(24, 24, 24, 0.12) 0%, rgba(24, 24, 24, 0.04) 100%)',
  '--bubble-ai': 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(241,241,241,0.94) 100%)'
});

type PersistedSavedSkin = Partial<SavedSkin> & {
  surfaceOverlayCSS?: string;
};

type PersistedSkinSnapshot = Partial<SkinSnapshot> & {
  surfaceOverlayCSS?: string;
};

type PersistedThemePatchLedgerEntry = Partial<ThemePatchLedgerEntry>;

export type PersistedThemeState = Omit<Partial<ThemeState>, 'savedSkins' | 'skinHistory' | 'patchLedger'> & {
  surfaceOverlayCSS?: string;
  savedSkins?: PersistedSavedSkin[];
  skinHistory?: PersistedSkinSnapshot[];
  patchLedger?: PersistedThemePatchLedgerEntry[];
};

function resolvePresetCss(sourcePresetId: string | null | undefined) {
  return sourcePresetId ? buildThemeFrameFromPresetId(sourcePresetId).presetCSS : '';
}

function readPersistedSurfaceOverlayCss(source: { generatedCSS?: unknown; surfaceOverlayCSS?: unknown } | null | undefined) {
  if (typeof source?.surfaceOverlayCSS === 'string') return source.surfaceOverlayCSS;
  if (typeof source?.generatedCSS === 'string') return source.generatedCSS;
  return '';
}

function normalizeCssLayers(
  sourcePresetId: string | null | undefined,
  source: { generatedCSS?: unknown; surfaceOverlayCSS?: unknown } | null | undefined
) {
  const presetCSS = resolvePresetCss(sourcePresetId);
  const normalizedGeneratedCSS = readPersistedSurfaceOverlayCss(source);

  return {
    presetCSS,
    generatedCSS: normalizedGeneratedCSS === presetCSS ? '' : normalizedGeneratedCSS
  };
}

function normalizeThemeRecipe(recipe: unknown): ThemeRecipeMeta | undefined {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return undefined;
  const parsed = recipe as Partial<ThemeRecipeMeta>;
  const name = parsed.name?.trim();
  if (!name) return undefined;
  const note = parsed.note?.trim();
  return { name, note: note || undefined };
}

function normalizeThemeToolMode(mode: unknown): ThemeToolMode {
  if (mode === 'creative') return 'creative';
  if (mode === 'off') return 'off';
  return 'stable';
}

function normalizeThemePatchLedgerStatus(status: unknown): ThemePatchLedgerStatus {
  if (status === 'applied' || status === 'rolled_back' || status === 'superseded') return status;
  return 'preview';
}

function normalizeThemePatchLayer(layer: unknown): ThemePatchLayer | undefined {
  if (layer === 'preset' || layer === 'custom' || layer === 'generated') return layer;
  return undefined;
}

function normalizeThemeToolScope(scope: unknown): ThemeToolScope | undefined {
  if (scope === 'collection' || scope === 'chat' || scope === 'app') return scope;
  return undefined;
}

function normalizeThemeToolPatchMode(patchMode: unknown): ThemeToolPatchMode | undefined {
  if (patchMode === 'replace' || patchMode === 'merge') return patchMode;
  return undefined;
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeThemeSkinRecord(
  raw: PersistedSavedSkin | PersistedSkinSnapshot | null | undefined,
  kind: 'saved' | 'snapshot'
): SavedSkin | SkinSnapshot | null {
  if (!raw?.id) return null;
  const now = Date.now();
  const sourcePresetId = typeof raw.sourcePresetId === 'string' ? raw.sourcePresetId : null;
  const cssLayers = normalizeCssLayers(sourcePresetId, raw);
  const baseRecord = {
    id: raw.id,
    sourcePresetId,
    cssVariables: { ...normalizeThemeVariables(raw.cssVariables ?? {}) },
    presetCSS: cssLayers.presetCSS,
    customCSS: typeof raw.customCSS === 'string' ? raw.customCSS : '',
    generatedCSS: cssLayers.generatedCSS,
    recipe: normalizeThemeRecipe(raw.recipe),
    createdAt: Number(raw.createdAt) || now
  };

  if (kind === 'saved') {
    const savedSkin = raw as PersistedSavedSkin;
    return {
      ...baseRecord,
      name: savedSkin.name?.trim() || '未命名皮肤',
      updatedAt: Number(savedSkin.updatedAt) || Number(savedSkin.createdAt) || now
    };
  }

  const snapshot = raw as PersistedSkinSnapshot;
  return {
    ...baseRecord,
    label: snapshot.label?.trim() || '历史版本',
    sourceSavedSkinId: typeof snapshot.sourceSavedSkinId === 'string' ? snapshot.sourceSavedSkinId : null
  };
}

function normalizeThemePatchLedgerEntry(
  raw: PersistedThemePatchLedgerEntry | null | undefined
): ThemePatchLedgerEntry | null {
  if (!raw?.id || !raw.previewId || !raw.conversationId || !raw.kind) return null;
  const now = Date.now();
  const label = raw.label?.trim() || raw.summary?.trim() || '未命名主题补丁';
  const summary = raw.summary?.trim() || label;
  return {
    id: raw.id,
    previewId: raw.previewId,
    conversationId: raw.conversationId,
    kind: raw.kind,
    label,
    summary,
    status: normalizeThemePatchLedgerStatus(raw.status),
    layer: normalizeThemePatchLayer(raw.layer),
    scope: normalizeThemeToolScope(raw.scope),
    surfaceIds: normalizeStringList(raw.surfaceIds),
    surfaceLabels: normalizeStringList(raw.surfaceLabels),
    patchMode: normalizeThemeToolPatchMode(raw.patchMode),
    detailText: typeof raw.detailText === 'string' ? raw.detailText : undefined,
    createdAt: Number(raw.createdAt) || now,
    updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || now
  };
}

function normalizeThemeState(theme: PersistedThemeState | null | undefined): ThemeState {
  const initial = createInitialThemeState();
  const savedSkins = (Array.isArray(theme?.savedSkins) ? theme.savedSkins : [])
    .map((savedSkin) => normalizeThemeSkinRecord(savedSkin, 'saved'))
    .filter((savedSkin): savedSkin is SavedSkin => Boolean(savedSkin));
  const skinHistory = (Array.isArray(theme?.skinHistory) ? theme.skinHistory : [])
    .map((snapshot) => normalizeThemeSkinRecord(snapshot, 'snapshot'))
    .filter((snapshot): snapshot is SkinSnapshot => Boolean(snapshot))
    .slice(0, HISTORY_LIMIT);
  const patchLedger = (Array.isArray(theme?.patchLedger) ? theme.patchLedger : [])
    .map((entry) => normalizeThemePatchLedgerEntry(entry))
    .filter((entry): entry is ThemePatchLedgerEntry => Boolean(entry));

  const activePresetId =
    theme?.activePresetId === null || typeof theme?.activePresetId === 'string'
      ? theme.activePresetId
      : initial.activePresetId;
  const activeSavedSkinId =
    theme?.activeSavedSkinId === null || typeof theme?.activeSavedSkinId === 'string'
      ? theme.activeSavedSkinId
      : null;
  const cssLayers = normalizeCssLayers(activePresetId, theme);
  const nextDefaultFrame = buildThemeFrameFromPresetId(DEFAULT_THEME_PRESET_ID);
  const hasNoThemeOverrides =
    activeSavedSkinId == null
    && savedSkins.length === 0
    && skinHistory.length === 0
    && !(typeof theme?.customCSS === 'string' && theme.customCSS.trim())
    && !readPersistedSurfaceOverlayCss(theme).trim();
  const matchesPurePresetDefault = (presetId: string) => {
    if (activePresetId !== presetId) return false;
    const presetFrame = buildThemeFrameFromPresetId(presetId);
    return areThemeVariablesEqual(
      normalizeThemeVariables(theme?.cssVariables ?? {}),
      presetFrame.cssVariables
    );
  };
  const shouldResetToCurrentDefault =
    hasNoThemeOverrides
    && DEFAULT_THEME_PRESET_ID === 'polaris-default'
    && (
      matchesPurePresetDefault('paper-butter')
      || (
        activePresetId === 'polaris-default'
        && areThemeVariablesEqual(
          normalizeThemeVariables(theme?.cssVariables ?? {}),
          LEGACY_POLARIS_DEFAULT_THEME_VARIABLES
        )
      )
      || (
        activePresetId === 'polaris-default'
        && areThemeVariablesEqual(
          normalizeThemeVariables(theme?.cssVariables ?? {}),
          WARM_ROOM_POLARIS_DEFAULT_THEME_VARIABLES
        )
      )
    );

  if (shouldResetToCurrentDefault) {
    return {
      ...initial,
      toolMode: normalizeThemeToolMode(theme?.toolMode),
      selectedSurfaceCodes: normalizeSelectedSurfaceCodes(theme?.selectedSurfaceCodes),
      activePresetId: nextDefaultFrame.activePresetId,
      cssVariables: { ...nextDefaultFrame.cssVariables },
      presetCSS: nextDefaultFrame.presetCSS,
      customCSS: '',
      generatedCSS: '',
      recipe: nextDefaultFrame.recipe ? { ...nextDefaultFrame.recipe } : undefined,
      savedSkins,
      skinHistory,
      patchLedger
    };
  }

  return {
    ...initial,
    toolMode: normalizeThemeToolMode(theme?.toolMode),
    selectedSurfaceCodes: normalizeSelectedSurfaceCodes(theme?.selectedSurfaceCodes),
    activePresetId,
    activeSavedSkinId: resolveSavedSkinId(savedSkins, activeSavedSkinId),
    cssVariables:
      theme?.cssVariables && typeof theme.cssVariables === 'object'
        ? {
            ...initial.cssVariables,
            ...normalizeThemeVariables(theme.cssVariables as ThemeVariables)
          }
        : { ...initial.cssVariables },
    presetCSS: cssLayers.presetCSS,
    customCSS: typeof theme?.customCSS === 'string' ? theme.customCSS : initial.customCSS,
    generatedCSS: cssLayers.generatedCSS,
    recipe: normalizeThemeRecipe(theme?.recipe),
    savedSkins,
    skinHistory,
    patchLedger
  };
}

function serializeSavedSkin(savedSkin: SavedSkin): PersistedSavedSkin {
  return {
    ...savedSkin,
    surfaceOverlayCSS: savedSkin.generatedCSS
  };
}

function serializeSkinSnapshot(snapshot: SkinSnapshot): PersistedSkinSnapshot {
  return {
    ...snapshot,
    surfaceOverlayCSS: snapshot.generatedCSS
  };
}

export function serializePersistedThemeState(theme: ThemeState): PersistedThemeState {
  return {
    ...theme,
    surfaceOverlayCSS: theme.generatedCSS,
    savedSkins: (theme.savedSkins ?? []).map((savedSkin) => serializeSavedSkin(savedSkin)),
    skinHistory: (theme.skinHistory ?? []).map((snapshot) => serializeSkinSnapshot(snapshot)),
    patchLedger: (theme.patchLedger ?? []).map((entry) => ({
      ...entry,
      surfaceIds: entry.surfaceIds ? [...entry.surfaceIds] : undefined,
      surfaceLabels: entry.surfaceLabels ? [...entry.surfaceLabels] : undefined
    }))
  };
}

export function migratePersistedThemeState(theme: PersistedThemeState | null | undefined): ThemeState {
  return normalizeThemeState(theme);
}
