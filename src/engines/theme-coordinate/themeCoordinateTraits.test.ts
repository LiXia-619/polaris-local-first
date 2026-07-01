import { describe, it, expect } from 'vitest';
import {
  describeThemeCoordinateTrait,
  selectThemeCoordinateTraits,
  THEME_COORDINATE_TRAIT_KEYS,
} from './themeCoordinateTraits';

describe('describeThemeCoordinateTrait', () => {
  it('returns description for every known trait', () => {
    for (const key of THEME_COORDINATE_TRAIT_KEYS) {
      const desc = describeThemeCoordinateTrait(key);
      expect(desc).not.toBeNull();
      expect(typeof desc).toBe('string');
      expect(desc!.length).toBeGreaterThan(0);
    }
  });

  it('returns null for undefined', () => {
    expect(describeThemeCoordinateTrait(undefined)).toBeNull();
  });
});

describe('selectThemeCoordinateTraits', () => {
  it('always assigns topbar trait', () => {
    const traits = selectThemeCoordinateTraits({ emotion: 0, meaning: 0, seed: 1, boostedSurfaces: [] });
    expect(traits.topbar).toBeDefined();
    expect(['topbar-fused', 'topbar-clear']).toContain(traits.topbar);
  });

  it('even seed → topbar-clear, odd seed → topbar-fused', () => {
    expect(selectThemeCoordinateTraits({ emotion: 0, meaning: 0, seed: 2, boostedSurfaces: [] }).topbar).toBe('topbar-clear');
    expect(selectThemeCoordinateTraits({ emotion: 0, meaning: 0, seed: 3, boostedSurfaces: [] }).topbar).toBe('topbar-fused');
  });

  it('is deterministic for same seed', () => {
    const args = { emotion: 5, meaning: -3, seed: 42, boostedSurfaces: [] as any[] };
    const a = selectThemeCoordinateTraits(args);
    const b = selectThemeCoordinateTraits(args);
    expect(a).toEqual(b);
  });

  it('returns only valid trait keys', () => {
    for (let seed = 0; seed < 30; seed++) {
      const traits = selectThemeCoordinateTraits({
        emotion: (seed % 21) - 10,
        meaning: (seed % 21) - 10,
        seed,
        boostedSurfaces: [],
      });
      for (const value of Object.values(traits)) {
        expect(THEME_COORDINATE_TRAIT_KEYS).toContain(value);
      }
    }
  });

  it('high meaning triggers frame traits', () => {
    // Run many seeds; at least some should produce frame traits
    let hasFrame = false;
    for (let seed = 0; seed < 50; seed++) {
      const traits = selectThemeCoordinateTraits({ emotion: 0, meaning: 8, seed, boostedSurfaces: [] });
      const values = Object.values(traits);
      if (values.some(v => v?.startsWith('frame-'))) {
        hasFrame = true;
        break;
      }
    }
    expect(hasFrame).toBe(true);
  });

  it('lets deep restrained mist occasionally drop the bubble shell entirely', () => {
    let hasBareBubble = false;
    for (let seed = 0; seed < 60; seed++) {
      const traits = selectThemeCoordinateTraits({ emotion: -8, meaning: -8, seed, boostedSurfaces: [] });
      if (Object.values(traits).includes('bubble-bare')) {
        hasBareBubble = true;
        break;
      }
    }
    expect(hasBareBubble).toBe(true);
  });

  it('lets deep restrained mist occasionally recess a bubble into the surface', () => {
    let hasRecessedBubble = false;
    for (let seed = 0; seed < 60; seed++) {
      const traits = selectThemeCoordinateTraits({ emotion: -8, meaning: -8, seed, boostedSurfaces: [] });
      if (Object.values(traits).includes('bubble-recessed')) {
        hasRecessedBubble = true;
        break;
      }
    }
    expect(hasRecessedBubble).toBe(true);
  });

  it('lets flower-mist expressive themes occasionally grow a cloud bubble and matching composer', () => {
    let hasCloudFamily = false;
    for (let seed = 0; seed < 80; seed++) {
      const traits = selectThemeCoordinateTraits({ emotion: 8, meaning: -7, seed, boostedSurfaces: [] });
      if (traits.composer === 'composer-cloud' && Object.values(traits).includes('bubble-cloud')) {
        hasCloudFamily = true;
        break;
      }
    }
    expect(hasCloudFamily).toBe(true);
  });

  it('keeps expressive flower-mist bubble shapes varied within the same keyword family', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 80; seed++) {
      const traits = selectThemeCoordinateTraits({ emotion: 8, meaning: -7, seed, boostedSurfaces: [] });
      const bubbleTrait = traits['chat-user-bubble'] ?? traits['chat-ai-bubble'];
      if (bubbleTrait?.startsWith('bubble-')) {
        seen.add(bubbleTrait);
      }
    }

    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
