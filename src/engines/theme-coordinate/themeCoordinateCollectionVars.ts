import { gradientPaint } from './themeCoordinateGradient';

type BaseColor = { h: number; s: number; l: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapHue(hue: number) {
  const wrapped = hue % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function normalizeSigned(value: number) {
  return (clamp(value, -10, 10) + 10) / 20;
}

function adjustColor(color: BaseColor, delta: Partial<BaseColor>) {
  return {
    h: wrapHue(color.h + (delta.h ?? 0)),
    s: clamp(color.s + (delta.s ?? 0), 0, 100),
    l: clamp(color.l + (delta.l ?? 0), 0, 100)
  } satisfies BaseColor;
}

function hsl(color: BaseColor, alpha = 1) {
  return `hsla(${Math.round(color.h)} ${clamp(color.s, 0, 100).toFixed(1)}% ${clamp(color.l, 0, 100).toFixed(1)}% / ${clamp(alpha, 0, 1).toFixed(3)})`;
}

export function buildCollectionStyleVars(args: {
  cardColor: BaseColor;
  cardFill: string;
  cardText: string;
  cardMuted: string;
  cardAccent: string;
  cardShadow: string;
  shellRestraint: number;
  emotion: number;
  familyId?: string;
}) {
  const { cardColor, cardFill, cardText, cardMuted, cardAccent, cardShadow, shellRestraint, emotion, familyId } = args;
  const woodFamily = familyId === 'grain-wood';
  const collectionCardSurface = woodFamily
    ? hsl(adjustColor(cardColor, { l: 4 + lerp(0, 1, shellRestraint), s: lerp(1, -3, shellRestraint), h: -2 }), lerp(0.22, 0.16, shellRestraint))
    : hsl(adjustColor(cardColor, { l: 10 + lerp(0, 4, shellRestraint), s: lerp(8, -2, shellRestraint), h: -8 }), lerp(0.68, 0.54, shellRestraint));
  const collectionCardSurfaceSolid = woodFamily
    ? hsl(adjustColor(cardColor, { l: 6 + lerp(0, 2, shellRestraint), s: lerp(2, -3, shellRestraint), h: 4 }), lerp(0.28, 0.2, shellRestraint))
    : hsl(adjustColor(cardColor, { l: 16 + lerp(0, 5, shellRestraint), s: lerp(10, -2, shellRestraint), h: 12 }), lerp(0.92, 0.84, shellRestraint));
  const collectionCardBackground = woodFamily
    ? `${cardFill}`
    : `${gradientPaint([
        hsl(adjustColor(cardColor, { l: 18 + lerp(0, 6, shellRestraint), s: lerp(12, -1, shellRestraint), h: -16 }), 0.18),
        hsl(adjustColor(cardColor, { l: 6 + lerp(0, 4, shellRestraint), s: lerp(8, -2, shellRestraint), h: 10 }), 0.08),
        hsl(adjustColor(cardColor, { l: -10 + lerp(0, 3, shellRestraint), s: lerp(2, -4, shellRestraint), h: 8 }), 0.04)
      ], 'vertical')}, ${cardFill}`;
  return {
    '--collection-card-fill': cardFill,
    '--collection-card-background': collectionCardBackground,
    '--collection-card-border-color': hsl(adjustColor(cardColor, { l: -16, s: lerp(6, -2, shellRestraint), h: 6 }), 0.42),
    '--collection-card-shadow': cardShadow,
    '--collection-card-hover-shadow': cardShadow,
    '--collection-card-pinned-shadow': cardShadow,
    '--collection-card-surface': collectionCardSurface,
    '--collection-card-surface-solid': collectionCardSurfaceSolid,
    '--collection-card-text': cardText,
    '--collection-card-text-soft': cardMuted,
    '--collection-card-text-muted': hsl(adjustColor(cardColor, { l: cardText === 'rgba(255,255,255,0.92)' ? 22 : -2, s: -6 }), 0.72),
    '--collection-card-accent': cardAccent,
    '--collection-card-accent-soft': hsl(adjustColor(cardColor, { l: 12 + lerp(0, 5, shellRestraint), s: lerp(16, -2, shellRestraint), h: 20 }), 0.3),
    '--collection-card-border': hsl(adjustColor(cardColor, { l: -12, s: -4 }), 0.22),
    '--collection-card-border-hover': hsl(adjustColor(cardColor, { l: -22, s: 10 }), 0.38),
    '--collection-card-code-strip-bg': `linear-gradient(90deg, ${hsl(adjustColor(cardColor, { l: -6, s: lerp(10, -2, shellRestraint), h: 12 }), woodFamily ? 0.12 : 0.22)}, transparent 72%), repeating-linear-gradient(90deg, ${hsl(adjustColor(cardColor, { l: -10, s: lerp(6, -3, shellRestraint) }), woodFamily ? 0.06 : 0.12)} 0 1px, transparent 1px 16px)`,
    '--collection-card-code-strip-opacity': `${lerp(woodFamily ? 0.05 : 0.18, woodFamily ? 0.12 : 0.34, normalizeSigned(emotion)).toFixed(3)}`,
    '--collection-card-divider-bg': `linear-gradient(90deg, transparent, ${hsl(adjustColor(cardColor, { l: -12, s: lerp(6, -3, shellRestraint) }), 0.16)}, transparent)`,
    '--collection-card-thread-bg': `linear-gradient(180deg, ${hsl(adjustColor(cardColor, { l: 10 + lerp(0, 5, shellRestraint), s: lerp(4, -2, shellRestraint) }), 0.46)}, ${hsl(adjustColor(cardColor, { l: -12 + lerp(0, 2, shellRestraint), s: lerp(2, -4, shellRestraint) }), 0.2)})`,
    '--collection-card-thread-opacity': `${lerp(0.12, 0.32, normalizeSigned(emotion)).toFixed(3)}`
  } satisfies Record<string, string>;
}
