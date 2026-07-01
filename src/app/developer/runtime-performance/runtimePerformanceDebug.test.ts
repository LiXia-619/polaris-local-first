import { beforeEach, describe, expect, it, vi } from 'vitest';

function createStorageMock(values: Record<string, string> = {}) {
  return {
    getItem: vi.fn((key: string) => values[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete values[key];
    })
  };
}

describe('runtimePerformanceDebug', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('does not persist theme sync samples when runtime performance debug is disabled', async () => {
    const localStorage = createStorageMock();
    vi.stubGlobal('window', {
      location: { search: '' },
      localStorage,
      dispatchEvent: vi.fn()
    });

    const { recordThemeSync } = await import('./runtimePerformanceDebug');
    recordThemeSync({
      varsChanged: 3,
      rewrittenLayers: ['generated'],
      animated: true,
      reasons: ['variables'],
      intervalMs: 12
    });

    expect(localStorage.getItem).toHaveBeenCalledWith('polaris-developer-mode');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('persists theme sync samples when developer mode enables runtime performance debug', async () => {
    const localStorage = createStorageMock({ 'polaris-developer-mode': '1' });
    vi.stubGlobal('window', {
      location: { search: '' },
      localStorage,
      dispatchEvent: vi.fn()
    });
    vi.stubGlobal('CustomEvent', class CustomEvent {
      type: string;

      constructor(type: string) {
        this.type = type;
      }
    });

    const { recordThemeSync } = await import('./runtimePerformanceDebug');
    recordThemeSync({
      varsChanged: 3,
      rewrittenLayers: ['generated'],
      animated: true,
      reasons: ['variables'],
      intervalMs: 12
    });

    expect(localStorage.setItem).toHaveBeenCalledOnce();
    const [, rawEntries] = localStorage.setItem.mock.calls[0] ?? [];
    expect(JSON.parse(rawEntries ?? '[]')).toEqual([
      expect.objectContaining({
        kind: 'theme-sync',
        varsChanged: 3,
        rewrittenLayers: ['generated'],
        animated: true,
        reasons: ['variables'],
        intervalMs: 12
      })
    ]);
  });
});
