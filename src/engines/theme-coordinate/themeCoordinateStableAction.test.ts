import { describe, expect, it } from 'vitest';
import {
  decodeLatestThemeCoordinateState,
  encodeThemeCoordinateStateComment
} from './themeCoordinateStableAction';

describe('themeCoordinateStableAction', () => {
  it('round-trips optional baseColor through embedded state comments', () => {
    const css = encodeThemeCoordinateStateComment({
      hue: 336,
      hueCount: 2,
      emotion: 2,
      meaning: 7,
      seed: 3,
      baseColor: '#f3b7c8'
    });

    expect(decodeLatestThemeCoordinateState(css)).toEqual({
      hue: 336,
      hueCount: 2,
      emotion: 2,
      meaning: 7,
      seed: 3,
      baseColor: '#f3b7c8'
    });
  });
});
