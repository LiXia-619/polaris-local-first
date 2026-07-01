import type { ToolInvocationKind } from '../toolInvocationKinds.js';
import type { ThemeSurfaceId, ThemeToolMode, ThemeToolPatchMode, ThemeToolScope } from './primitives';

export type ThemeVariables = Record<string, string>;

export interface ThemeRecipeMeta {
  name: string;
  note?: string;
}

export interface ThemeFrame {
  activePresetId: string | null;
  activeSavedSkinId: string | null;
  cssVariables: ThemeVariables;
  presetCSS: string;
  customCSS: string;
  generatedCSS: string;
  recipe?: ThemeRecipeMeta;
}

export interface ThemePreset {
  id: string;
  name: string;
  mood: string;
  description: string;
  cssVariables: ThemeVariables;
  css: string;
  recipe?: ThemeRecipeMeta;
  styleLabel?: string;
  visibleInStudio?: boolean;
}

export interface SavedSkin {
  id: string;
  name: string;
  sourcePresetId: string | null;
  cssVariables: ThemeVariables;
  presetCSS: string;
  customCSS: string;
  generatedCSS: string;
  recipe?: ThemeRecipeMeta;
  createdAt: number;
  updatedAt: number;
}

export interface SkinSnapshot {
  id: string;
  label: string;
  sourcePresetId: string | null;
  sourceSavedSkinId: string | null;
  createdAt: number;
  cssVariables: ThemeVariables;
  presetCSS: string;
  customCSS: string;
  generatedCSS: string;
  recipe?: ThemeRecipeMeta;
}

export type ThemePatchLedgerStatus = 'preview' | 'applied' | 'rolled_back' | 'superseded';
export type ThemePatchLayer = 'preset' | 'custom' | 'generated';

export interface ThemePatchLedgerEntry {
  id: string;
  previewId: string;
  conversationId: string;
  kind: ToolInvocationKind;
  label: string;
  summary: string;
  status: ThemePatchLedgerStatus;
  layer?: ThemePatchLayer;
  scope?: ThemeToolScope;
  surfaceIds?: ThemeSurfaceId[];
  surfaceLabels?: string[];
  patchMode?: ThemeToolPatchMode;
  detailText?: string;
  createdAt: number;
  updatedAt: number;
}

export type ThemeGeneratedSurfaceLayerSummary = {
  surfaceId: ThemeSurfaceId;
  label: string;
  scope: ThemeToolScope;
  layerCount: number;
  layerIds: string[];
  operations: ThemeToolPatchMode[];
};

export interface ThemeState extends ThemeFrame {
  toolMode: ThemeToolMode;
  selectedSurfaceCodes: string[];
  savedSkins: SavedSkin[];
  skinHistory: SkinSnapshot[];
  patchLedger: ThemePatchLedgerEntry[];
}

