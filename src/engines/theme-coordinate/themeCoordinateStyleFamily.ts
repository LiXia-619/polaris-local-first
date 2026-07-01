import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';
import type { BaseColor, ThemeCoordinateState } from './themeCoordinateTypes';

export type ThemeCoordinateStyleFamily =
  | 'mist-glass'
  | 'paper-room'
  | 'candy-bloom'
  | 'quiet-ink'
  | 'crafted-fabric'
  | 'dark-instrument';

export const THEME_COORDINATE_STYLE_FAMILIES: ThemeCoordinateStyleFamily[] = [
  'mist-glass',
  'paper-room',
  'candy-bloom',
  'quiet-ink',
  'crafted-fabric',
  'dark-instrument'
];

export function describeThemeCoordinateStyleFamily(family: ThemeCoordinateStyleFamily) {
  switch (family) {
    case 'mist-glass':
      return 'mist glass';
    case 'paper-room':
      return 'paper room';
    case 'candy-bloom':
      return 'candy bloom';
    case 'quiet-ink':
      return 'quiet ink';
    case 'crafted-fabric':
      return 'crafted fabric';
    case 'dark-instrument':
      return 'dark instrument';
    default:
      return 'stable family';
  }
}

export function resolveThemeCoordinateStyleFamily(
  state: Pick<ThemeCoordinateState, 'emotion' | 'meaning' | 'hueCount'>
): ThemeCoordinateStyleFamily {
  const expressive = state.emotion >= 6;
  const restrained = state.emotion <= -4;
  const airy = state.meaning <= -3;
  const tactile = state.meaning >= 3;

  if (expressive && state.meaning <= 3 && state.hueCount >= 3) return 'candy-bloom';
  if (state.meaning >= 7 && state.emotion >= 3) return 'dark-instrument';
  if (restrained && state.meaning <= 2) return 'quiet-ink';
  if (airy) return 'mist-glass';
  if (tactile && state.emotion >= 3) return 'crafted-fabric';
  return 'paper-room';
}

function pickSurfaceVariant(seed: number, surface: ThemeCoordinateSurface, span: number) {
  return Math.abs(seed * 29 + surface.length * 17) % span;
}

export function resolveThemeCoordinateFamilyTextureLabel(args: {
  family: ThemeCoordinateStyleFamily;
  surface: ThemeCoordinateSurface;
  baseTextureLabel: string;
  seed: number;
}) {
  const { family, surface, seed } = args;
  const variant = pickSurfaceVariant(seed, surface, 3);

  switch (family) {
    case 'mist-glass':
      if (surface === 'background') return variant === 0 ? 'glass' : 'wash-cloud';
      if (surface === 'topbar') return variant === 1 ? 'glass' : 'frosted-glass';
      if (surface === 'chat-user-bubble' || surface === 'chat-ai-bubble') {
        return variant === 2 ? 'wash-cloud' : 'frosted-glass';
      }
      return 'frosted-glass';
    case 'paper-room':
      if (args.baseTextureLabel === 'linen' || args.baseTextureLabel === 'paper' || args.baseTextureLabel === 'paper-fiber') {
        return args.baseTextureLabel;
      }
      if (surface === 'background') return variant === 0 ? 'paper-fiber' : 'paper';
      if (surface === 'topbar' || surface === 'system-note') return variant === 1 ? 'paper-fiber' : 'linen';
      return variant === 2 ? 'washi-paper' : 'paper';
    case 'candy-bloom':
      if (surface === 'background') return variant === 0 ? 'pearlescent' : 'candy-film';
      if (surface === 'topbar' || surface === 'panel') return variant === 1 ? 'pearlescent' : 'frosted-glass';
      if (surface === 'chat-user-bubble' || surface === 'chat-ai-bubble') {
        if (args.baseTextureLabel === 'wash-cloud') return 'wash-cloud';
        return variant === 2 ? 'wash-cloud' : 'candy-film';
      }
      return variant === 0 ? 'pearlescent' : 'candy-film';
    case 'quiet-ink':
      if (surface === 'background') return variant === 0 ? 'powder-dust' : 'paper-fiber';
      if (surface === 'topbar') return variant === 1 ? 'frosted-glass' : 'paper-fiber';
      return variant === 2 ? 'linen' : 'paper-fiber';
    case 'crafted-fabric':
      if (surface === 'background' || surface === 'topbar') return variant === 0 ? 'linen' : 'fabric';
      if (surface === 'card' || surface === 'panel') return variant === 2 ? 'leather' : 'fabric';
      return variant === 1 ? 'washi-paper' : 'linen';
    case 'dark-instrument':
      if (surface === 'chat-user-bubble' || surface === 'chat-ai-bubble') return 'leather';
      return surface === 'system-note' ? 'fabric' : 'leather';
    default:
      return args.baseTextureLabel;
  }
}

export function resolveThemeCoordinateFamilyColorDelta(args: {
  family: ThemeCoordinateStyleFamily;
  surface: ThemeCoordinateSurface;
}) {
  const { family, surface } = args;
  const structural = surface === 'panel' || surface === 'card' || surface === 'composer' || surface === 'system-note';
  const bubble = surface === 'chat-user-bubble' || surface === 'chat-ai-bubble';

  switch (family) {
    case 'mist-glass':
      return { s: bubble ? -10 : -14, l: surface === 'background' ? 7 : bubble ? 5 : 3, h: surface === 'chat-user-bubble' ? -6 : 4 } satisfies Partial<BaseColor>;
    case 'paper-room':
      return { s: -18, l: surface === 'background' ? 10 : structural ? 7 : 4, h: -2 } satisfies Partial<BaseColor>;
    case 'candy-bloom':
      return { s: surface === 'background' ? 20 : bubble ? 14 : 8, l: structural ? 5 : 8, h: bubble ? 8 : -6 } satisfies Partial<BaseColor>;
    case 'quiet-ink':
      return { s: -24, l: surface === 'background' ? -3 : structural ? 1 : 4, h: -8 } satisfies Partial<BaseColor>;
    case 'crafted-fabric':
      return { s: -8, l: surface === 'background' ? -2 : structural ? -4 : 0, h: 5 } satisfies Partial<BaseColor>;
    case 'dark-instrument':
      return { s: surface === 'background' ? 5 : -2, l: surface === 'background' ? -12 : structural ? -9 : -5, h: 10 } satisfies Partial<BaseColor>;
    default:
      return {} satisfies Partial<BaseColor>;
  }
}
