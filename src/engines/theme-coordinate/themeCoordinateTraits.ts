import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';
import type { ThemeCoordinateStyleFamily } from './themeCoordinateStyleFamily';

export type ThemeCoordinateTraitKey =
  | 'topbar-fused'
  | 'topbar-clear'
  | 'bubble-cloud'
  | 'bubble-bare'
  | 'bubble-recessed'
  | 'bubble-floating'
  | 'bubble-outline'
  | 'bubble-pill'
  | 'bubble-arch'
  | 'bubble-round-left'
  | 'bubble-left-rail'
  | 'bubble-soft-asym'
  | 'bubble-soft-square'
  | 'bubble-cut-corner'
  | 'frame-dashed'
  | 'frame-dotted'
  | 'frame-double'
  | 'frame-shadow-only'
  | 'note-tag'
  | 'composer-cloud'
  | 'composer-tray'
  | 'composer-pill'
  | 'stitched';

export type ThemeCoordinateTraitMap = Partial<Record<ThemeCoordinateSurface, ThemeCoordinateTraitKey>>;

export const THEME_COORDINATE_TRAIT_KEYS: ThemeCoordinateTraitKey[] = [
  'topbar-fused',
  'topbar-clear',
  'bubble-cloud',
  'bubble-bare',
  'bubble-recessed',
  'bubble-floating',
  'bubble-outline',
  'bubble-pill',
  'bubble-arch',
  'bubble-round-left',
  'bubble-left-rail',
  'bubble-soft-asym',
  'bubble-soft-square',
  'bubble-cut-corner',
  'frame-dashed',
  'frame-dotted',
  'frame-double',
  'frame-shadow-only',
  'note-tag',
  'composer-cloud',
  'composer-tray',
  'composer-pill',
  'stitched'
];

function mulberry32(seed: number) {
  let next = seed >>> 0;
  return () => {
    next += 0x6D2B79F5;
    let t = next;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeightedSurface(args: {
  random: () => number;
  candidates: ThemeCoordinateSurface[];
  boostedSurfaces: ThemeCoordinateSurface[];
}) {
  const weighted = [
    ...args.candidates.filter((surface) => args.boostedSurfaces.includes(surface)),
    ...args.candidates
  ];
  if (!weighted.length) return null;
  return weighted[Math.floor(args.random() * weighted.length)] ?? null;
}

function assignTrait(map: ThemeCoordinateTraitMap, surface: ThemeCoordinateSurface | null, trait: ThemeCoordinateTraitKey) {
  if (!surface || map[surface]) return;
  map[surface] = trait;
}

export function describeThemeCoordinateTrait(trait: ThemeCoordinateTraitKey | undefined) {
  switch (trait) {
    case 'topbar-fused':
      return 'fused topbar';
    case 'topbar-clear':
      return 'clear topbar';
    case 'bubble-cloud':
      return 'cloud bubble';
    case 'bubble-bare':
      return 'bare bubble';
    case 'bubble-recessed':
      return 'recessed bubble';
    case 'bubble-floating':
      return 'floating bubble';
    case 'bubble-outline':
      return 'outline bubble';
    case 'bubble-pill':
      return 'pill bubble';
    case 'bubble-arch':
      return 'arch bubble';
    case 'bubble-round-left':
      return 'round left';
    case 'bubble-left-rail':
      return 'left rail';
    case 'bubble-soft-asym':
      return 'soft asym';
    case 'bubble-soft-square':
      return 'soft square';
    case 'bubble-cut-corner':
      return 'cut corner';
    case 'frame-dashed':
      return 'dashed frame';
    case 'frame-dotted':
      return 'dotted frame';
    case 'frame-double':
      return 'double frame';
    case 'frame-shadow-only':
      return 'shadow only';
    case 'note-tag':
      return 'tag note';
    case 'composer-cloud':
      return 'cloud composer';
    case 'composer-tray':
      return 'tray composer';
    case 'composer-pill':
      return 'pill composer';
    case 'stitched':
      return 'stitched edge';
    default:
      return null;
  }
}

export function selectThemeCoordinateTraits(args: {
  emotion: number;
  meaning: number;
  seed: number;
  boostedSurfaces: ThemeCoordinateSurface[];
  styleFamily?: ThemeCoordinateStyleFamily;
}): ThemeCoordinateTraitMap {
  const { emotion, meaning, boostedSurfaces } = args;
  const random = mulberry32(args.seed * 97 + 13);
  const traits: ThemeCoordinateTraitMap = {};
  const bubbleCandidates: ThemeCoordinateSurface[] = ['chat-user-bubble', 'chat-ai-bubble'];
  const frameCandidates: ThemeCoordinateSurface[] =
    meaning >= 4 ? ['chat-user-bubble', 'chat-ai-bubble', 'card', 'panel', 'system-note'] : ['chat-user-bubble', 'chat-ai-bubble', 'card', 'panel', 'system-note'];

  traits.topbar = args.seed % 2 === 0 ? 'topbar-clear' : 'topbar-fused';

  if (emotion >= 6 && meaning <= -5 && random() < 0.44) {
    assignTrait(
      traits,
      pickWeightedSurface({ random, candidates: bubbleCandidates, boostedSurfaces }),
      'bubble-cloud'
    );
    if (random() < 0.9) {
      assignTrait(traits, 'composer', 'composer-cloud');
    }
  }

  if (emotion <= -3 && meaning <= -2 && random() < 0.9) {
    const airyLowLeft = emotion <= -6 && meaning <= -6;
    const airyRoll = random();
    assignTrait(
      traits,
      pickWeightedSurface({ random, candidates: bubbleCandidates, boostedSurfaces }),
      airyLowLeft
        ? airyRoll < 0.2
          ? 'bubble-bare'
          : airyRoll < 0.48
            ? 'bubble-recessed'
            : airyRoll < 0.7
              ? 'bubble-left-rail'
              : 'bubble-outline'
        : airyRoll < 0.42
          ? 'bubble-left-rail'
          : 'bubble-outline'
    );
  }

  if (emotion >= -1 && emotion <= 3 && meaning >= 3 && random() < 0.9) {
    assignTrait(
      traits,
      pickWeightedSurface({ random, candidates: bubbleCandidates, boostedSurfaces }),
      random() < 0.32 ? 'bubble-round-left' : 'bubble-pill'
    );
  }

  if (emotion >= 4 && meaning >= -1 && meaning <= 5 && random() < 0.72) {
    assignTrait(
      traits,
      pickWeightedSurface({ random, candidates: bubbleCandidates, boostedSurfaces }),
      random() < 0.44 ? 'bubble-soft-asym' : 'bubble-cut-corner'
    );
  }

  if (emotion >= 5 && meaning <= -2 && random() < 0.66) {
    assignTrait(
      traits,
      pickWeightedSurface({ random, candidates: bubbleCandidates, boostedSurfaces }),
      random() < 0.18 ? 'bubble-arch' : random() < 0.6 ? 'bubble-round-left' : 'bubble-left-rail'
    );
  }

  if (emotion <= 0 && meaning >= 2 && random() < 0.62) {
    assignTrait(
      traits,
      pickWeightedSurface({ random, candidates: bubbleCandidates, boostedSurfaces }),
      random() < 0.4 ? 'bubble-soft-asym' : 'bubble-soft-square'
    );
  }

  if (meaning >= 4 && random() < 0.95) {
    const frameSurface = pickWeightedSurface({ random, candidates: frameCandidates, boostedSurfaces }) ?? 'card';
    const frameTrait =
      emotion >= 4
        ? (random() < 0.45 ? 'frame-double' : 'frame-dashed')
        : random() < 0.5
          ? 'frame-dotted'
          : 'frame-dashed';
    assignTrait(traits, frameSurface, frameTrait);
  }

  if (emotion >= 6 && meaning >= -1 && random() < 0.58) {
    assignTrait(
      traits,
      pickWeightedSurface({ random, candidates: frameCandidates, boostedSurfaces }) ?? 'card',
      random() < 0.34 ? 'frame-dotted' : 'frame-dashed'
    );
  }

  if (emotion <= -5 && meaning <= 2 && random() < 0.64) {
    assignTrait(
      traits,
      pickWeightedSurface({ random, candidates: frameCandidates, boostedSurfaces }) ?? 'panel',
      'frame-shadow-only'
    );
  }

  if (meaning <= -1 && emotion <= 2 && random() < 0.65) {
    assignTrait(traits, 'system-note', 'note-tag');
  }

  if (meaning >= 1 && emotion <= 1 && random() < 0.6) {
    assignTrait(traits, 'composer', 'composer-tray');
  }

  if (meaning <= -1 && emotion >= 4 && random() < 0.52) {
    assignTrait(traits, 'composer', 'composer-pill');
  }

  if (meaning >= 5 && emotion >= 3 && random() < 0.72) {
    assignTrait(
      traits,
      pickWeightedSurface({ random, candidates: ['card', 'panel'], boostedSurfaces }) ?? 'card',
      'stitched'
    );
  }

  switch (args.styleFamily) {
    case 'mist-glass':
      traits.topbar = 'topbar-clear';
      traits['chat-user-bubble'] = 'bubble-cloud';
      traits['chat-ai-bubble'] = 'bubble-floating';
      traits.composer = 'composer-cloud';
      break;
    case 'paper-room':
      traits.topbar = 'topbar-fused';
      traits['chat-user-bubble'] = 'bubble-soft-square';
      traits['chat-ai-bubble'] = 'bubble-round-left';
      traits['system-note'] = 'note-tag';
      traits.composer = 'composer-tray';
      break;
    case 'candy-bloom':
      traits.topbar = 'topbar-clear';
      traits['chat-user-bubble'] = 'bubble-pill';
      traits['chat-ai-bubble'] = 'bubble-cloud';
      traits.composer = 'composer-pill';
      break;
    case 'quiet-ink':
      traits.topbar = 'topbar-clear';
      traits['chat-user-bubble'] = 'bubble-left-rail';
      traits['chat-ai-bubble'] = 'bubble-bare';
      traits.composer = 'composer-tray';
      break;
    case 'crafted-fabric':
      traits.topbar = 'topbar-fused';
      traits['chat-user-bubble'] = 'bubble-soft-square';
      traits['chat-ai-bubble'] = 'bubble-soft-asym';
      traits.card = 'stitched';
      traits.panel = 'frame-dashed';
      break;
    case 'dark-instrument':
      traits.topbar = 'topbar-fused';
      traits['chat-user-bubble'] = 'bubble-cut-corner';
      traits['chat-ai-bubble'] = 'bubble-left-rail';
      traits.composer = 'composer-tray';
      traits.panel = 'frame-double';
      break;
    default:
      break;
  }

  return traits;
}
