import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import { writeTextToClipboard } from './clipboard';

vi.mock('@capacitor/clipboard', () => ({
  Clipboard: {
    write: vi.fn(async () => undefined)
  }
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false)
  }
}));

describe('writeTextToClipboard', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Clipboard.write).mockResolvedValue(undefined);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses the native clipboard bridge on native platforms', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await writeTextToClipboard('hello');

    expect(Clipboard.write).toHaveBeenCalledWith({ string: 'hello' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('uses the browser clipboard outside native shells', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await writeTextToClipboard('hello');

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(Clipboard.write).not.toHaveBeenCalled();
  });
});
