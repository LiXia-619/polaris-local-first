import { describe, expect, it } from 'vitest';
import {
  resolveImageResizeDimensions,
  shouldProcessRasterImage
} from './imageAssetProcessing';

describe('shouldProcessRasterImage', () => {
  it('accepts still raster formats that can be canvas processed', () => {
    expect(shouldProcessRasterImage('image/jpeg')).toBe(true);
    expect(shouldProcessRasterImage('image/png; charset=utf-8')).toBe(true);
    expect(shouldProcessRasterImage('IMAGE/WEBP')).toBe(true);
  });

  it('leaves animated/vector/unknown images untouched', () => {
    expect(shouldProcessRasterImage('image/gif')).toBe(false);
    expect(shouldProcessRasterImage('image/svg+xml')).toBe(false);
    expect(shouldProcessRasterImage('application/octet-stream')).toBe(false);
  });
});

describe('resolveImageResizeDimensions', () => {
  it('keeps images that already fit inside the target edge', () => {
    expect(resolveImageResizeDimensions(900, 600, 1080)).toBeNull();
  });

  it('scales landscape images to the target edge', () => {
    expect(resolveImageResizeDimensions(4000, 2000, 1080)).toEqual({
      width: 1080,
      height: 540
    });
  });

  it('scales portrait images to the target edge', () => {
    expect(resolveImageResizeDimensions(2000, 4000, 1080)).toEqual({
      width: 540,
      height: 1080
    });
  });

  it('rejects invalid source geometry', () => {
    expect(resolveImageResizeDimensions(0, 4000, 1080)).toBeNull();
    expect(resolveImageResizeDimensions(4000, 0, 1080)).toBeNull();
    expect(resolveImageResizeDimensions(4000, 2000, 0)).toBeNull();
  });
});
