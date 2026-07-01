import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractThemeAssetIds, resolveThemeAssetUrls } from './themeAssetCss';
import { getAssetDataUrl } from '../infrastructure/assetStore';

vi.mock('../infrastructure/assetStore', () => ({
  getAssetDataUrl: vi.fn()
}));

const mockedGetAssetDataUrl = vi.mocked(getAssetDataUrl);

describe('themeAssetCss', () => {
  beforeEach(() => {
    mockedGetAssetDataUrl.mockReset();
  });

  it('extracts unique Polaris asset ids from CSS urls', () => {
    expect(extractThemeAssetIds(`
      .bubble::after { background-image: url("polaris-asset://asset-one"); }
      .bubble::before { background-image: url('polaris-asset://asset-one'); }
      .other { background-image: url(polaris-asset://asset-two); }
    `)).toEqual(['asset-one', 'asset-two']);
  });

  it('resolves Polaris asset urls to local data urls', async () => {
    mockedGetAssetDataUrl.mockResolvedValue('data:image/png;base64,abc');

    await expect(resolveThemeAssetUrls(
      '.bubble::after { background-image: url("polaris-asset://asset-one"); }'
    )).resolves.toContain('url("data:image/png;base64,abc")');
    expect(mockedGetAssetDataUrl).toHaveBeenCalledWith('asset-one');
  });

  it('leaves missing assets untouched', async () => {
    mockedGetAssetDataUrl.mockResolvedValue(null);

    await expect(resolveThemeAssetUrls(
      '.bubble::after { background-image: url("polaris-asset://missing"); }'
    )).resolves.toContain('polaris-asset://missing');
  });
});
