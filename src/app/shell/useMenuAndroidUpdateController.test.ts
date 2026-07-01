import { describe, expect, it, vi } from 'vitest';
import { openMenuAndroidUpdateUrl } from './useMenuAndroidUpdateController';

function createBrowserWindow(openResult: Window | null) {
  return {
    open: vi.fn(() => openResult),
    location: {
      href: ''
    } as Location
  } as Pick<Window, 'open' | 'location'>;
}

describe('menu android update controller', () => {
  it('opens update links in a new isolated tab', () => {
    const browserWindow = createBrowserWindow({} as Window);

    openMenuAndroidUpdateUrl('https://example.com/update.apk', browserWindow);

    expect(browserWindow.open).toHaveBeenCalledWith(
      'https://example.com/update.apk',
      '_blank',
      'noopener,noreferrer'
    );
    expect(browserWindow.location.href).toBe('');
  });

  it('falls back to same-window navigation when popup opening is blocked', () => {
    const browserWindow = createBrowserWindow(null);

    openMenuAndroidUpdateUrl('https://example.com/update.apk', browserWindow);

    expect(browserWindow.location.href).toBe('https://example.com/update.apk');
  });
});
