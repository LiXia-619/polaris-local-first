import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebugLog } from './debugLog';

function createStorageMock() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    })
  };
}

describe('createDebugLog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores bounded entries in localStorage', () => {
    const storage = createStorageMock();
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn()
    });
    vi.stubGlobal('CustomEvent', class CustomEvent {
      constructor(public type: string) {}
    });

    const log = createDebugLog<{ value: number }>('polaris-test-log', { maxEntries: 2 });

    log.append({ value: 1 });
    log.append({ value: 2 });
    log.append({ value: 3 });

    expect(log.read()).toEqual([{ value: 2 }, { value: 3 }]);
  });

  it('broadcasts on append and clear when configured', () => {
    const storage = createStorageMock();
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent
    });
    vi.stubGlobal('CustomEvent', class CustomEvent {
      constructor(public type: string) {}
    });

    const log = createDebugLog<{ ok: boolean }>('polaris-test-log', {
      maxEntries: 4,
      broadcastEvent: 'polaris:test-log-updated'
    });

    log.append({ ok: true });
    log.clear();

    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    expect(dispatchEvent.mock.calls.map(([event]) => event.type)).toEqual([
      'polaris:test-log-updated',
      'polaris:test-log-updated'
    ]);
    expect(log.read()).toEqual([]);
  });

  it('appends batches with one localStorage write', () => {
    const storage = createStorageMock();
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn()
    });
    vi.stubGlobal('CustomEvent', class CustomEvent {
      constructor(public type: string) {}
    });

    const log = createDebugLog<{ value: number }>('polaris-test-log', { maxEntries: 3 });

    log.append({ value: 1 });
    storage.setItem.mockClear();
    storage.getItem.mockClear();

    log.appendMany([{ value: 2 }, { value: 3 }, { value: 4 }]);

    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(log.read()).toEqual([{ value: 2 }, { value: 3 }, { value: 4 }]);
  });
});
