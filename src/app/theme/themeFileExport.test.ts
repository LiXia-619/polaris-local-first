import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeState = vi.hoisted(() => ({
  canUseNative: false,
  exportFile: vi.fn()
}));

vi.mock('../../native/systemBackupFiles', () => ({
  canUseNativeSystemBackupFiles: () => nativeState.canUseNative,
  exportFileViaSystemFiles: nativeState.exportFile
}));

import { exportThemeFile } from './themeFileExport';

describe('exportThemeFile', () => {
  beforeEach(() => {
    nativeState.canUseNative = false;
    nativeState.exportFile.mockReset();
  });

  it('uses browser download on web builds', async () => {
    const browserDownload = vi.fn();
    const blob = new Blob(['theme'], { type: 'text/css' });

    const exported = await exportThemeFile(blob, 'skin.polaris-theme.css', browserDownload);

    expect(exported).toBe(true);
    expect(browserDownload).toHaveBeenCalledWith(blob, 'skin.polaris-theme.css');
    expect(nativeState.exportFile).not.toHaveBeenCalled();
  });

  it('uses native system files on app builds', async () => {
    nativeState.canUseNative = true;
    nativeState.exportFile.mockResolvedValue(true);
    const browserDownload = vi.fn();
    const blob = new Blob(['theme'], { type: 'text/css' });

    const exported = await exportThemeFile(blob, 'skin.polaris-theme.css', browserDownload);

    expect(exported).toBe(true);
    expect(nativeState.exportFile).toHaveBeenCalledWith(blob, 'skin.polaris-theme.css');
    expect(browserDownload).not.toHaveBeenCalled();
  });

  it('propagates native cancelation as a non-exported result', async () => {
    nativeState.canUseNative = true;
    nativeState.exportFile.mockResolvedValue(false);

    await expect(exportThemeFile(
      new Blob(['theme'], { type: 'text/css' }),
      'skin.polaris-theme.css',
      vi.fn()
    )).resolves.toBe(false);
  });
});
