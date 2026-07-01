import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';
import { isTactileTextureLabel } from './themeCoordinateTextureProfile';

type BaseColor = {
  h: number;
  s: number;
  l: number;
};

export type ThemeGradientMode = 'vertical' | 'horizontal' | 'diagonal' | 'radial';
export type ThemeGradientVariant = 'solid' | 'smooth' | 'wash' | 'bloom' | 'mesh' | 'halo';

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

function restraintStrength(emotion: number, meaning: number) {
  return clamp((-emotion + Math.max(0, meaning - 1) * 0.55) / 10, 0, 1);
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

function isStructuralSurface(surface: ThemeCoordinateSurface) {
  return surface === 'composer' || surface === 'system-note' || surface === 'panel' || surface === 'card';
}

function resolveGradientDiscipline(args: {
  surface: ThemeCoordinateSurface;
  emotion: number;
  meaning: number;
  textureLabel?: string;
}) {
  const { surface, emotion, meaning } = args;
  const tactile = isTactileTextureLabel(args.textureLabel ?? '');
  const structural = isStructuralSurface(surface);
  const bubble = surface.includes('bubble');
  const content = structural || bubble;
  const abstract = meaning <= -4;
  const tactileSide = meaning >= 2 || tactile;

  if (surface === 'background') {
    return {
      hueCap: tactile ? 2 : 9,
      preferSolid: false,
      opacityScale: tactile ? 0.94 : 1
    };
  }

  if (surface === 'topbar') {
    return {
      hueCap: abstract ? 1 : tactileSide ? 1 : 2,
      preferSolid: tactileSide || meaning <= -6,
      opacityScale: abstract ? 0.62 : 0.74
    };
  }

  if (!content) {
    return {
      hueCap: tactile ? 2 : 3,
      preferSolid: tactileSide && emotion <= 5,
      opacityScale: 0.88
    };
  }

  if (tactileSide) {
    return {
      hueCap: 1,
      preferSolid: true,
      opacityScale: structural ? 0.84 : 0.88
    };
  }

  if (abstract) {
    return {
      hueCap: structural ? 1 : emotion >= 6 ? 4 : emotion >= 3 ? 3 : 2,
      preferSolid: structural || emotion <= 5,
      opacityScale: structural ? 0.78 : 0.84
    };
  }

  return {
    hueCap: structural ? 1 : emotion >= 5 ? 3 : 2,
    preferSolid: structural || emotion <= 4,
    opacityScale: structural ? 0.82 : 0.88
  };
}

export function gradientPaint(stops: string[], mode: ThemeGradientMode) {
  const stopList = stops.join(', ');
  if (mode === 'horizontal') return `linear-gradient(90deg, ${stopList})`;
  if (mode === 'diagonal') return `linear-gradient(135deg, ${stopList})`;
  if (mode === 'radial') return `radial-gradient(circle at 22% 18%, ${stopList})`;
  return `linear-gradient(180deg, ${stopList})`;
}

export function resolveGradientMode(hue: number, emotion: number, meaning: number, seed: number, surface: ThemeCoordinateSurface) {
  const surfaceIndex = [
    'background',
    'topbar',
    'chat-user-bubble',
    'chat-ai-bubble',
    'composer',
    'system-note',
    'panel',
    'card'
  ].indexOf(surface);
  const modes = ['vertical', 'horizontal', 'diagonal', 'radial'] as const;
  if (meaning <= -3) {
    const abstractModes = surface === 'background' || surface === 'topbar'
      ? (['radial', 'diagonal', 'vertical', 'radial'] as const)
      : (['radial', 'vertical', 'diagonal', 'radial'] as const);
    return abstractModes[(seed + surfaceIndex + Math.round(emotion / 4) + Math.floor(hue / 90)) % abstractModes.length];
  }
  return modes[(Math.floor(hue / 45) + seed + surfaceIndex + Math.round(emotion / 3) + Math.round(meaning / 4)) % modes.length];
}

export function buildSurfaceHueCount(args: {
  surface: ThemeCoordinateSurface;
  maxHueCount: number;
  emotion: number;
  meaning?: number;
  seed: number;
  textureLabel?: string;
}) {
  const { surface, emotion, seed } = args;
  const maxHueCount = clamp(Math.round(args.maxHueCount), 1, 9);
  if (maxHueCount <= 1) return 1;
  const tactile = isTactileTextureLabel(args.textureLabel ?? '');
  const hueCap = tactile
    ? clamp(Math.min(maxHueCount, surface === 'background' ? 3 : surface === 'topbar' ? 2 : surface.includes('bubble') ? 2 : 2), 1, maxHueCount)
    : maxHueCount;
  if (hueCap <= 1) return 1;
  let next = (seed * 131 + surface.length * 19 + Math.round(emotion * 7)) >>> 0;
  next += 0x6d2b79f5;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const random = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  const surfaceBias = tactile
    ? surface === 'background'
      ? 0.66
      : surface === 'topbar'
        ? 0.26
        : surface.includes('bubble')
          ? 0.22
          : surface === 'card'
            ? 0.3
            : 0.24
    : surface === 'background'
      ? 0.98
      : surface === 'topbar'
        ? 0.74
        : surface.includes('bubble')
          ? 0.88
          : surface === 'card'
            ? 0.68
            : 0.58;
  const emotionBias = tactile ? normalizeSigned(emotion) * 0.58 : normalizeSigned(emotion);
  const localMax = clamp(Math.round(lerp(Math.min(2, hueCap), hueCap, surfaceBias * 0.54 + emotionBias * 0.46)), 1, hueCap);
  const localMin =
    tactile
      ? clamp(surface === 'background' && emotion >= 6 ? 2 : 1, 1, localMax)
      : maxHueCount >= 3 && (surface === 'background' || surface.includes('bubble') || surface === 'card')
        ? clamp(emotion >= 5 ? 3 : emotion >= 2 ? 2 : 1, 1, localMax)
      : 1;
  let localHueCount = clamp(localMin + Math.floor(random * (localMax - localMin + 1)), 1, hueCap);

  if (!tactile && maxHueCount >= 7) {
    const expressiveAbstract = (args.meaning ?? 0) <= 1;
    if (surface === 'background') {
      const boostedMin = clamp(maxHueCount >= 9 ? 6 : maxHueCount >= 8 ? 5 : 4, 1, hueCap);
      localHueCount = Math.max(localHueCount, boostedMin);
    } else if (surface.includes('bubble') && expressiveAbstract && emotion >= 4) {
      localHueCount = Math.max(localHueCount, clamp(emotion >= 7 ? 4 : 3, 1, hueCap));
    } else if ((surface === 'panel' || surface === 'card') && expressiveAbstract && emotion >= 6) {
      localHueCount = Math.max(localHueCount, clamp(2, 1, hueCap));
    }
  }

  return clamp(localHueCount, 1, hueCap);
}

export function buildHueStops(args: {
  color: BaseColor;
  localHueCount: number;
  hueSpread: number;
  emotion: number;
  meaning: number;
  opacityScale: number;
  surface: ThemeCoordinateSurface;
}) {
  const { color, localHueCount, hueSpread, emotion, meaning, opacityScale, surface } = args;
  const darkBias = clamp((meaning - 5.8) / 4.2, 0, 1);
  const airyBias = clamp((-meaning - 2) / 8, 0, 1);
  const restraint = restraintStrength(emotion, meaning);
  const vividBackground = surface === 'background' && localHueCount >= 5;
  const vividBoost = vividBackground ? lerp(0.28, 1, (localHueCount - 5) / 4) : 0;
  const saturationStart = lerp(6, -4, restraint) + vividBoost * 10;
  const saturationEnd = lerp(12, 1, restraint) + vividBoost * 12;
  if (localHueCount <= 1) {
    const highlightShift = lerp(12, 18, airyBias);
    const shadowShift = lerp(-8, -24, darkBias);
    const highlightAlpha = lerp(0.88, 0.94, airyBias) * opacityScale;
    const shadowAlpha = lerp(0.9, 0.98, darkBias) * opacityScale;
    return [
      `${hsl(adjustColor(color, { l: highlightShift, s: lerp(4, 8, airyBias), h: lerp(4, 8, airyBias) }), highlightAlpha)} 0%`,
      `${hsl(adjustColor(color, { l: shadowShift, s: lerp(-2, -10, darkBias), h: lerp(0, 3, darkBias) }), shadowAlpha)} 100%`
    ];
  }
  const stops = Array.from({ length: localHueCount }, (_, index) => {
    const progress = localHueCount === 1 ? 0 : index / (localHueCount - 1);
    const hueShift = vividBackground
      ? lerp(-hueSpread * 0.64, hueSpread * 1.18, progress)
      : lerp(-hueSpread * 0.42, hueSpread, progress);
    const lightnessShift = vividBackground
      ? lerp(18, -12, progress)
      : lerp(16, -8, progress);
    const saturationShift = lerp(saturationStart, saturationEnd, progress);
    const alpha = lerp(vividBackground ? 0.98 : 0.95, vividBackground ? 0.92 : 0.88, progress) * opacityScale;
    return `${hsl(adjustColor(color, { l: lightnessShift, s: saturationShift, h: hueShift }), alpha)} ${Math.round(progress * 100)}%`;
  });
  if (darkBias > 0.06 && (surface === 'background' || surface.includes('bubble') || surface === 'card')) {
    const inkStop = hsl(
      adjustColor(color, {
        l: lerp(-14, -46, darkBias),
        s: lerp(6, -10, darkBias),
        h: lerp(10, 2, darkBias)
      }),
      lerp(0.86, 0.94, darkBias) * opacityScale
    );
    stops[stops.length - 1] = `${inkStop} 100%`;
  }
  return stops;
}

function resolveGradientVariant(args: {
  surface: ThemeCoordinateSurface;
  localHueCount: number;
  emotion: number;
  meaning: number;
  seed: number;
  textureLabel?: string;
}) {
  const { surface, localHueCount, emotion, meaning, seed } = args;
  if (localHueCount <= 1) return 'smooth' satisfies ThemeGradientVariant;
  if (meaning <= -4) {
    if (surface === 'background') return emotion >= 5 ? 'halo' : 'wash';
    if (surface === 'topbar' || surface.includes('bubble')) return emotion >= 7 ? 'halo' : emotion >= 4 ? 'bloom' : 'wash';
    return 'wash';
  }
  if (meaning >= 4 && !isTactileTextureLabel(args.textureLabel ?? '')) {
    if (surface === 'background' || surface === 'card' || surface === 'panel') return emotion >= 5 ? 'mesh' : 'smooth';
    return 'smooth';
  }
  if (isTactileTextureLabel(args.textureLabel ?? '')) {
    const canWash =
      (surface === 'background' && (localHueCount >= 2 || emotion >= 5)) ||
      (surface !== 'topbar' && emotion >= 4 && meaning <= 4 && localHueCount >= 2);
    return canWash ? 'wash' : 'smooth';
  }
  const restraint = restraintStrength(emotion, meaning);
  if (restraint >= 0.82) return surface === 'background' ? 'wash' : 'smooth';
  if (restraint >= 0.62) return surface === 'background' || surface === 'topbar' ? 'wash' : 'smooth';
  const variantIndex = (seed + surface.length + localHueCount + Math.round(emotion) + Math.round(meaning)) % 7;
  if (surface === 'background') {
    const canHalo = meaning <= -4 && emotion >= 5 && localHueCount >= 3;
    if (canHalo) return variantIndex === 0 ? 'halo' : variantIndex <= 4 ? 'wash' : variantIndex === 5 ? 'mesh' : 'smooth';
    return variantIndex <= 4 ? 'wash' : variantIndex === 5 ? 'mesh' : 'smooth';
  }
  if (surface === 'topbar') return variantIndex <= 5 ? 'wash' : 'smooth';
  if (surface.includes('bubble')) {
    const canHalo = meaning <= -4 && emotion >= 6 && localHueCount >= 3;
    const canBloom = emotion >= 6 && meaning <= 1;
    if (canHalo && variantIndex === 0) return 'halo';
    if (canBloom && variantIndex === 1) return 'bloom';
    return variantIndex <= 3 ? 'wash' : 'smooth';
  }
  return variantIndex <= 2 ? 'wash' : variantIndex === 3 ? 'mesh' : 'smooth';
}

function renderGradientVariant(args: {
  variant: ThemeGradientVariant;
  stops: string[];
  mode: ThemeGradientMode;
  opacityScale: number;
  seed: number;
}) {
  const { variant, stops, mode, opacityScale, seed } = args;
  if (variant === 'solid') {
    const first = stops[0]?.replace(/ [0-9]+%$/, '') ?? 'transparent';
    const last = stops[stops.length - 1]?.replace(/ [0-9]+%$/, '') ?? first;
    return `color-mix(in srgb, ${first} 52%, ${last} 48%)`;
  }
  const base = gradientPaint(stops, mode);
  if (variant === 'smooth') return base;
  const bloomAlpha = opacityScale * 0.62;
  const bloomA = `radial-gradient(circle at ${18 + (seed % 21)}% ${16 + (seed % 17)}%, color-mix(in srgb, ${stops[0]?.replace(/ [0-9]+%$/, '')} ${Math.round(bloomAlpha * 100)}%, transparent) 0 0%, transparent 42%)`;
  const bloomB = `radial-gradient(circle at ${68 + (seed % 11)}% ${24 + (seed % 19)}%, color-mix(in srgb, ${stops[Math.max(1, Math.floor(stops.length / 2))]?.replace(/ [0-9]+%$/, '')} ${Math.round(bloomAlpha * 86)}%, transparent) 0 0%, transparent 38%)`;
  if (variant === 'halo') {
    return `radial-gradient(circle at 50% 42%, transparent 0 32%, color-mix(in srgb, ${stops[0]?.replace(/ [0-9]+%$/, '')} ${Math.round(opacityScale * 56)}%, transparent) 46%, transparent 72%), ${bloomA}, ${base}`;
  }
  if (variant === 'mesh') {
    return `linear-gradient(135deg, color-mix(in srgb, ${stops[0]?.replace(/ [0-9]+%$/, '')} ${Math.round(opacityScale * 64)}%, transparent), transparent 34%), linear-gradient(45deg, color-mix(in srgb, ${stops[stops.length - 1]?.replace(/ [0-9]+%$/, '')} ${Math.round(opacityScale * 62)}%, transparent), transparent 38%), ${base}`;
  }
  if (variant === 'bloom') {
    return `${bloomA}, ${bloomB}, ${base}`;
  }
  const washC = `radial-gradient(circle at ${52 + (seed % 13)}% ${72 + (seed % 9)}%, ${stops[stops.length - 1]?.replace(/ [0-9]+%$/, '')} 0 0%, transparent 34%)`;
  return `${bloomA}, ${bloomB}, ${washC}, ${base}`;
}

export function buildSurfaceGradient(args: {
  surface: ThemeCoordinateSurface;
  color: BaseColor;
  maxHueCount: number;
  emotion: number;
  meaning: number;
  opacityScale: number;
  seed: number;
  mode: ThemeGradientMode;
  textureLabel?: string;
}) {
  const { surface, color, maxHueCount, emotion, meaning, opacityScale, seed, mode } = args;
  const tactile = isTactileTextureLabel(args.textureLabel ?? '');
  const discipline = resolveGradientDiscipline({
    surface,
    emotion,
    meaning,
    textureLabel: args.textureLabel
  });
  const requestedHueCount = buildSurfaceHueCount({
    surface,
    maxHueCount,
    emotion,
    meaning,
    seed,
    textureLabel: args.textureLabel
  });
  const localHueCount = clamp(Math.min(requestedHueCount, discipline.hueCap), 1, maxHueCount);
  const restraint = restraintStrength(emotion, meaning);
  const hueSpreadScale = tactile ? (surface === 'background' ? 0.62 : surface.includes('bubble') ? 0.32 : 0.4) : 1;
  const hueSpread =
    localHueCount <= 1
      ? 0
      : (lerp(22, 208, (clamp(localHueCount, 1, 9) - 1) / 8) * lerp(1, 0.48, restraint) + Math.max(0, emotion) * (tactile ? 1.1 : 2.2)) *
        hueSpreadScale;
  const tunedOpacityScale = opacityScale * discipline.opacityScale;
  const stops = buildHueStops({
    color,
    localHueCount,
    hueSpread,
    emotion,
    meaning,
    opacityScale: tunedOpacityScale,
    surface
  });
  const variant = maxHueCount <= 1
    ? 'solid'
    : discipline.preferSolid
    ? 'solid'
    : resolveGradientVariant({
        surface,
        localHueCount,
        emotion,
        meaning,
        seed,
        textureLabel: args.textureLabel
      });
  return {
    fill: renderGradientVariant({
      variant,
      stops,
      mode,
      opacityScale: tunedOpacityScale,
      seed
    }),
    localHueCount,
    label: `${variant}-${mode}/${localHueCount}h`
  };
}
