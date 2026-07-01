import { describe, expect, it } from 'vitest';
import { analyzeImageData } from './imageAssetTools';

describe('analyzeImageData', () => {
  it('extracts average color, transparency, text color, and dominant palette buckets', () => {
    const imageData = {
      data: new Uint8ClampedArray([
        255, 0, 0, 255,
        255, 0, 0, 255,
        0, 0, 255, 255,
        0, 0, 0, 128
      ])
    } as ImageData;

    const result = analyzeImageData(imageData, 3);

    expect(result.hasTransparency).toBe(true);
    expect(result.averageColor).toBe('#800040');
    expect(result.suggestedTextColor).toBe('#f8fafc');
    expect(result.palette.map((color) => color.hex)).toEqual(['#ff0000', '#0000ff', '#000000']);
    expect(result.palette[0]?.count).toBe(2);
    expect(result.palette[0]?.ratio).toBe(0.5);
  });

  it('falls back to a white average when every pixel is fully transparent', () => {
    const imageData = {
      data: new Uint8ClampedArray([
        12, 20, 30, 0,
        200, 180, 160, 0
      ])
    } as ImageData;

    const result = analyzeImageData(imageData);

    expect(result.hasTransparency).toBe(true);
    expect(result.averageColor).toBe('#ffffff');
    expect(result.suggestedTextColor).toBe('#111827');
    expect(result.palette).toEqual([]);
  });
});
