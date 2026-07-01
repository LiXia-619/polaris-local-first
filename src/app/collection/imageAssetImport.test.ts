import { describe, expect, it } from 'vitest';
import {
  parseImageImportTextInput,
  resolveImagePreviewDimensions,
  shouldCreateImagePreview
} from './imageAssetImport';

describe('parseImageImportTextInput', () => {
  it('accepts a direct image url', () => {
    expect(parseImageImportTextInput('https://polaris.example.com/shared-materials/abc.png')).toEqual({
      url: '/shared-materials/abc.png',
      title: undefined
    });
  });

  it('routes shared material links back through the current deployment API path', () => {
    expect(parseImageImportTextInput('https://materials.example.com/shared-materials/abc.png')).toEqual({
      url: '/shared-materials/abc.png',
      title: undefined
    });
  });

  it('extracts the url and meaningful name from share text', () => {
    expect(parseImageImportTextInput([
      'Polaris 北极星素材',
      '来源：Polaris 北极星',
      '名称：小星星壁纸',
      '链接：https://polaris.example.com/shared-materials/abc.png'
    ].join('\n'))).toEqual({
      url: '/shared-materials/abc.png',
      title: '小星星壁纸'
    });
  });

  it('drops fallback names when importing shared material text', () => {
    expect(parseImageImportTextInput([
      'Polaris 北极星素材',
      '来源：Polaris 北极星',
      '名称：参考图',
      '链接：https://polaris.example.com/shared-materials/abc.png'
    ].join('\n'))).toEqual({
      url: '/shared-materials/abc.png',
      title: undefined
    });
  });
});

describe('shouldCreateImagePreview', () => {
  it('only creates raster still-image previews', () => {
    expect(shouldCreateImagePreview('image/jpeg')).toBe(true);
    expect(shouldCreateImagePreview('image/png')).toBe(true);
    expect(shouldCreateImagePreview('image/webp')).toBe(true);
    expect(shouldCreateImagePreview('image/gif')).toBe(false);
    expect(shouldCreateImagePreview('image/svg+xml')).toBe(false);
  });
});

describe('resolveImagePreviewDimensions', () => {
  it('keeps small images on the original preview blob', () => {
    expect(resolveImagePreviewDimensions(640, 420, 768)).toBeNull();
  });

  it('scales landscape images to the preview edge', () => {
    expect(resolveImagePreviewDimensions(4000, 2000, 768)).toEqual({
      width: 768,
      height: 384
    });
  });

  it('scales portrait images to the preview edge', () => {
    expect(resolveImagePreviewDimensions(1200, 2400, 768)).toEqual({
      width: 384,
      height: 768
    });
  });
});
