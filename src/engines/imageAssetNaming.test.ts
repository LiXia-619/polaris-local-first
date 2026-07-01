import { describe, expect, it } from 'vitest';
import { isGenericImageTitle } from './imageAssetNaming';

describe('isGenericImageTitle', () => {
  it('treats fallback image labels as generic', () => {
    expect(isGenericImageTitle('参考图')).toBe(true);
    expect(isGenericImageTitle('图片收藏')).toBe(true);
    expect(isGenericImageTitle('image-123')).toBe(true);
  });

  it('keeps user-authored names usable', () => {
    expect(isGenericImageTitle('小星星壁纸')).toBe(false);
    expect(isGenericImageTitle('Polaris 北极星素材')).toBe(false);
  });
});
