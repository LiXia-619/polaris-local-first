import { buildCollectionStyleVars } from './themeCoordinateCollectionVars';
import { buildThemeCoordinateControlStyleVars } from './themeCoordinateControlVars';
import {
  THEME_COORDINATE_SURFACE_PREFIX,
  THEME_COORDINATE_SURFACES
} from './themeCoordinateSurfaceMeta';
import { adjustColor, hsl, type ThemeCoordinateSpaceLayout } from './themeCoordinateSpaceLayout';

type BaseColor = Parameters<typeof hsl>[0];

function seededSignedUnit(seed: number, salt: number) {
  let next = (seed * 131 + salt * 977 + 0x6D2B79F5) >>> 0;
  next += 0x6D2B79F5;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
}

function buildWorldTone(args: {
  backgroundColor: BaseColor;
  seed: number;
  world: 'cool' | 'warm';
}) {
  const { backgroundColor, seed, world } = args;
  const jitter = seededSignedUnit(seed, world === 'cool' ? 71 : 89);
  if (world === 'cool') {
    return adjustColor(backgroundColor, {
      h: -22 + jitter * 6,
      s: 8 + Math.max(0, jitter) * 5,
      l: -7 + jitter * 3
    });
  }
  return adjustColor(backgroundColor, {
    h: 18 + jitter * 6,
    s: 7 + Math.max(0, -jitter) * 5,
    l: 5 + jitter * 3
  });
}

function buildWorldBackground(args: {
  world: 'cool' | 'warm';
  backgroundFill: string;
  worldColor: BaseColor;
  seed: number;
}) {
  const { world, backgroundFill, worldColor, seed } = args;
  const offset = seededSignedUnit(seed, world === 'cool' ? 101 : 131);
  const glowA = world === 'cool'
    ? hsl(adjustColor(worldColor, { l: 18, s: 14, h: -10 }), 0.3)
    : hsl(adjustColor(worldColor, { l: 16, s: 16, h: 14 }), 0.32);
  const glowB = world === 'cool'
    ? hsl(adjustColor(worldColor, { l: -18, s: 6, h: -16 }), 0.24)
    : hsl(adjustColor(worldColor, { l: -14, s: 8, h: 18 }), 0.24);
  const veil = world === 'cool'
    ? hsl(adjustColor(worldColor, { l: 4, s: -2, h: -12 }), 0.14)
    : hsl(adjustColor(worldColor, { l: 10, s: 0, h: 12 }), 0.14);
  const field = world === 'cool'
    ? `linear-gradient(160deg, ${hsl(adjustColor(worldColor, { l: 8, s: 6, h: -10 }), 0.16)}, transparent 58%)`
    : `linear-gradient(160deg, ${hsl(adjustColor(worldColor, { l: 10, s: 8, h: 14 }), 0.18)}, transparent 58%)`;
  return [
    `radial-gradient(circle at ${16 + offset * 5}% ${14 + offset * 4}%, ${glowA} 0, transparent 40%)`,
    `radial-gradient(circle at ${82 - offset * 6}% ${84 - offset * 5}%, ${glowB} 0, transparent 46%)`,
    field,
    `linear-gradient(180deg, ${veil}, transparent 56%)`,
    backgroundFill
  ].join(', ');
}

export function buildThemeCoordinateStyleVars(layout: ThemeCoordinateSpaceLayout): Record<string, string> {
  const { normalizedState, specs, backgroundColor, cardColor, shellRestraint } = layout;
  const coolWorldColor = buildWorldTone({
    backgroundColor,
    seed: normalizedState.seed,
    world: 'cool'
  });
  const warmWorldColor = buildWorldTone({
    backgroundColor,
    seed: normalizedState.seed,
    world: 'warm'
  });
  const bgGlowTop = `radial-gradient(circle at top, ${hsl(adjustColor(backgroundColor, { l: 12, s: 10, h: 18 }), 0.44)}, ${hsl(adjustColor(backgroundColor, { l: -8, s: 0, h: -12 }), 0)})`;
  const bgGlowBottom = `radial-gradient(circle at bottom, ${hsl(adjustColor(backgroundColor, { l: -4, s: 6, h: -18 }), 0.34)}, ${hsl(adjustColor(backgroundColor, { l: 16, s: 8, h: 16 }), 0)})`;
  const collectionStyleVars = buildCollectionStyleVars({
    cardColor,
    cardFill: specs.card.fill,
    cardText: specs.card.text,
    cardMuted: specs.card.muted,
    cardAccent: specs.card.accent,
    cardShadow: specs.card.shadow,
    shellRestraint,
    emotion: normalizedState.emotion
  });
  const controlStyleVars = buildThemeCoordinateControlStyleVars(backgroundColor);
  const styleVars: Record<string, string> = {
    '--bg': specs.background.fill,
    '--card-bg': specs.card.fill,
    '--surface': hsl(adjustColor(backgroundColor, { l: 9, s: -5 }), 0.72),
    '--surface-solid': hsl(adjustColor(backgroundColor, { l: 14, s: -8 }), 0.92),
    '--surface-deep': hsl(adjustColor(backgroundColor, { l: -8, s: 2 }), 0.88),
    '--border': hsl(adjustColor(backgroundColor, { l: -14, s: -4 }), 0.22),
    '--border-hover': hsl(adjustColor(backgroundColor, { l: -22, s: 10 }), 0.38),
    '--text': specs.background.text,
    '--text-soft': specs.topbar.text,
    '--text-muted': specs['system-note'].muted,
    '--accent': specs['chat-user-bubble'].accent,
    '--accent-soft': hsl(adjustColor(backgroundColor, { l: 10, s: 14, h: 22 }), 0.34),
    '--accent-glow': hsl(adjustColor(backgroundColor, { l: 18, s: 22, h: -18 }), 0.28),
    '--bubble-user': specs['chat-user-bubble'].fill,
    '--shadow-bubble': specs['chat-user-bubble'].shadow,
    '--shadow-panel': specs.panel.shadow,
    '--radius-panel': specs.panel.radius,
    ...collectionStyleVars,
    ...controlStyleVars,
    '--cool-bg': buildWorldBackground({
      world: 'cool',
      backgroundFill: specs.background.fill,
      worldColor: coolWorldColor,
      seed: normalizedState.seed
    }),
    '--cool-surface': hsl(adjustColor(coolWorldColor, { l: 8, s: -2, h: -6 }), 0.72),
    '--cool-surface-solid': hsl(adjustColor(coolWorldColor, { l: 13, s: -6, h: -8 }), 0.92),
    '--cool-surface-deep': hsl(adjustColor(coolWorldColor, { l: -10, s: 4, h: -8 }), 0.88),
    '--cool-border': hsl(adjustColor(coolWorldColor, { l: -16, s: -2, h: -6 }), 0.24),
    '--cool-border-hover': hsl(adjustColor(coolWorldColor, { l: -24, s: 12, h: -10 }), 0.42),
    '--cool-text': specs.background.text,
    '--cool-text-soft': specs.topbar.text,
    '--cool-text-muted': specs['system-note'].muted,
    '--cool-accent': specs['chat-user-bubble'].accent,
    '--cool-accent-soft': hsl(adjustColor(coolWorldColor, { l: 10, s: 16, h: 8 }), 0.36),
    '--cool-accent-glow': hsl(adjustColor(coolWorldColor, { l: 20, s: 24, h: -28 }), 0.3),
    '--warm-bg': buildWorldBackground({
      world: 'warm',
      backgroundFill: specs.background.fill,
      worldColor: warmWorldColor,
      seed: normalizedState.seed
    }),
    '--warm-surface': hsl(adjustColor(warmWorldColor, { l: 9, s: 0, h: 10 }), 0.74),
    '--warm-surface-solid': hsl(adjustColor(warmWorldColor, { l: 14, s: -3, h: 12 }), 0.92),
    '--warm-surface-deep': hsl(adjustColor(warmWorldColor, { l: -8, s: 6, h: 14 }), 0.88),
    '--warm-border': hsl(adjustColor(warmWorldColor, { l: -14, s: -1, h: 12 }), 0.24),
    '--warm-border-hover': hsl(adjustColor(warmWorldColor, { l: -22, s: 11, h: 14 }), 0.42),
    '--warm-text': specs.background.text,
    '--warm-text-soft': specs.topbar.text,
    '--warm-text-muted': specs['system-note'].muted,
    '--warm-accent': specs.card.accent,
    '--warm-accent-soft': hsl(adjustColor(warmWorldColor, { l: 8, s: 14, h: 36 }), 0.36),
    '--warm-accent-glow': hsl(adjustColor(warmWorldColor, { l: 20, s: 20, h: 22 }), 0.3),
    '--tc-shell-glow-top': bgGlowTop,
    '--tc-shell-glow-bottom': bgGlowBottom
  };

  for (const surface of THEME_COORDINATE_SURFACES) {
    const prefix = THEME_COORDINATE_SURFACE_PREFIX[surface];
    const spec = specs[surface];
    styleVars[`--tc-${prefix}-fill`] = spec.fill;
    styleVars[`--tc-${prefix}-border-paint`] = spec.borderPaint;
    styleVars[`--tc-${prefix}-border-width`] = spec.borderWidth;
    styleVars[`--tc-${prefix}-border-style`] = spec.borderStyle;
    styleVars[`--tc-${prefix}-radius`] = spec.radius;
    styleVars[`--tc-${prefix}-shadow`] = spec.shadow;
    styleVars[`--tc-${prefix}-text`] = spec.text;
    styleVars[`--tc-${prefix}-muted`] = spec.muted;
    styleVars[`--tc-${prefix}-accent`] = spec.accent;
    styleVars[`--tc-${prefix}-blur`] = spec.blur;
    styleVars[`--tc-${prefix}-padding`] = spec.padding;
    styleVars[`--tc-${prefix}-line-height`] = spec.lineHeight;
    styleVars[`--tc-${prefix}-letter-spacing`] = spec.letterSpacing;
  }

  return styleVars;
}
