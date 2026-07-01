import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POLARIS_DEVELOPER_MODE_EVENT } from '../../app/developer/developerModeRuntime';

function createStorageMock(values: Record<string, string> = {}) {
  return {
    getItem: vi.fn((key: string) => values[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values[key] = value;
    })
  };
}

describe('debugSurfaceState', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('enables debug surfaces from query params without developer mode', async () => {
    vi.stubGlobal('window', {
      location: { search: '?debugPerf=1' },
      localStorage: createStorageMock()
    });

    const { readDebugSurfaceEnabled } = await import('./debugSurfaceState');

    expect(readDebugSurfaceEnabled({ queryParams: ['debugRuntimePerformance', 'debugPerf'] })).toBe(true);
  });

  it('can use developer mode as a shared debug surface switch', async () => {
    vi.stubGlobal('window', {
      location: { search: '' },
      localStorage: createStorageMock({ 'polaris-developer-mode': '1' })
    });

    const { readDebugSurfaceEnabled } = await import('./debugSurfaceState');

    expect(readDebugSurfaceEnabled({ developerMode: true, queryParams: ['debugRequest'] })).toBe(true);
    expect(readDebugSurfaceEnabled({ queryParams: ['debugRequest'] })).toBe(false);
  });

  it('subscribes and unsubscribes the requested window events', async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', {
      addEventListener,
      removeEventListener
    });

    const { subscribeWindowSyncEvents } = await import('./debugSurfaceState');
    const sync = vi.fn();

    const unsubscribe = subscribeWindowSyncEvents([POLARIS_DEVELOPER_MODE_EVENT, 'storage'], sync);
    expect(addEventListener.mock.calls.map(([eventName]) => eventName)).toEqual([
      POLARIS_DEVELOPER_MODE_EVENT,
      'storage'
    ]);

    unsubscribe();
    expect(removeEventListener.mock.calls.map(([eventName]) => eventName)).toEqual([
      POLARIS_DEVELOPER_MODE_EVENT,
      'storage'
    ]);
  });

  it('closes developer debug surfaces and removes debug query params', async () => {
    const localStorage = createStorageMock({ 'polaris-developer-mode': '1' });
    const replaceState = vi.fn();
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', {
      location: {
        href: 'http://127.0.0.1:5173/?debugRequest=1&debugAssets=1&keep=1#top',
        search: '?debugRequest=1&debugAssets=1&keep=1',
        pathname: '/',
        hash: '#top'
      },
      history: {
        state: { route: 'current' },
        replaceState
      },
      localStorage,
      dispatchEvent
    });

    const { closeDebugSurfaces } = await import('./debugSurfaceState');
    closeDebugSurfaces();

    expect(localStorage.setItem).toHaveBeenCalledWith('polaris-developer-mode', '0');
    expect(replaceState).toHaveBeenCalledWith({ route: 'current' }, '', '/?keep=1#top');
    expect(dispatchEvent).toHaveBeenCalled();
  });
});
