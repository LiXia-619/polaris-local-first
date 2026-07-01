import { compileThemeSelectorCssAction } from '../themeSelectorCssCompiler';
import type { ThemeVariables } from '../../types/domain';
import type { ThemeCoordinatePreview } from './themeCoordinateSpaceMapping';
import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';
import type { ThemeCoordinateTargetPart } from './themeCoordinateTargetRef';

export type SurfaceTargetParts = Partial<Record<ThemeCoordinateSurface, Set<ThemeCoordinateTargetPart>>>;

export const SHARED_SCOPE_KEYS = [
  '--bg', '--surface', '--surface-solid', '--surface-deep', '--border', '--border-hover',
  '--text', '--text-soft', '--text-muted', '--accent', '--accent-soft', '--accent-glow'
] as const;

export const CHAT_SCOPE_KEYS = [
  ...SHARED_SCOPE_KEYS,
  '--cool-bg', '--cool-surface', '--cool-surface-solid', '--cool-surface-deep',
  '--cool-border', '--cool-border-hover', '--cool-text', '--cool-text-soft', '--cool-text-muted',
  '--cool-accent', '--cool-accent-soft', '--cool-accent-glow', '--bubble-user', '--shadow-bubble', '--shadow-panel', '--radius-panel'
] as const;

export const COLLECTION_SCOPE_KEYS = [
  ...SHARED_SCOPE_KEYS,
  '--warm-bg', '--warm-surface', '--warm-surface-solid', '--warm-surface-deep',
  '--warm-border', '--warm-border-hover', '--warm-text', '--warm-text-soft', '--warm-text-muted',
  '--warm-accent', '--warm-accent-soft', '--warm-accent-glow', '--card-bg'
] as const;

export function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

export function cssBlock(selector: string, declarations: string) {
  const compiled = compileThemeSelectorCssAction({ selector, cssText: declarations });
  return compiled.ok ? compiled.cssText : '';
}

export function buildVarDeclarations(styleVars: ThemeVariables, keys: readonly string[]) {
  return keys
    .filter((key) => typeof styleVars[key] === 'string' && !key.startsWith('--tc-'))
    .map((key) => `${key}: ${styleVars[key]};`)
    .join('\n');
}

export function hasWholeSurfaceSelection(targetParts: SurfaceTargetParts | undefined, surface: ThemeCoordinateSurface) {
  return !(targetParts?.[surface] && targetParts[surface]!.size > 0);
}

export function isPrototypeFamily(preview: ThemeCoordinatePreview, familyId: string) {
  if (!('prototype' in preview)) return false;
  const prototypePreview = preview as ThemeCoordinatePreview & { prototype?: { familyId?: string } };
  return prototypePreview.prototype?.familyId === familyId;
}

export function isTactileMaterialTexture(textureLabel: string) {
  return ['paper', 'paper-fiber', 'washi-paper', 'linen', 'fabric', 'leather'].includes(textureLabel);
}

export function usesMaterialRecessedMorphology(preview: ThemeCoordinatePreview) {
  const textureLabel = preview.surfaceSpecs.card.textureLabel;
  if (preview.state.meaning < 4 || !isTactileMaterialTexture(textureLabel)) return false;
  const roll = Math.abs(
    preview.state.seed * 17
    + Math.round(preview.state.meaning) * 13
    + Math.round(preview.state.emotion) * 7
    + preview.state.hueCount * 19
    + textureLabel.length * 11
  ) % 5;
  if (preview.state.meaning >= 8) return roll <= 2;
  if (preview.state.meaning >= 6) return roll <= 1;
  return roll === 0;
}
