import { afterEach, describe, expect, it, vi } from 'vitest';
import { readClientErrorLog } from './clientErrorLog';
import {
  clearLatestPersistenceError,
  readLatestPersistenceError,
  reportPersistenceError,
  subscribeLatestPersistenceError
} from './persistenceDiagnostics';

function createStorageMock(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
}

describe('reportPersistenceError', () => {
  afterEach(() => {
    clearLatestPersistenceError();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps persistence failures in the local client error log', () => {
    const localStorage = createStorageMock();
    vi.stubGlobal('window', {
      localStorage,
      location: { href: 'http://localhost/polaris' }
    });
    const error = new Error('IndexedDB write failed');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reportPersistenceError({
      label: '[store:persist]',
      store: 'chat',
      operation: 'write'
    }, error);

    expect(warnSpy).toHaveBeenCalledWith('[store:persist]', error);
    expect(readClientErrorLog()[0]).toMatchObject({
      source: 'persistence',
      message: 'IndexedDB write failed',
      context: 'chat:write',
      url: 'http://localhost/polaris'
    });
    expect(readLatestPersistenceError()).toMatchObject({
      label: '[store:persist]',
      store: 'chat',
      operation: 'write',
      message: 'IndexedDB write failed'
    });
  });

  it('clears the runtime persistence error marker without touching stored diagnostics', () => {
    vi.stubGlobal('window', {
      localStorage: createStorageMock(),
      location: { href: 'http://localhost/polaris' }
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    reportPersistenceError({
      label: '[store:persist]',
      store: 'runtime',
      operation: 'read'
    }, 'runtime read failed');

    expect(readLatestPersistenceError()?.message).toBe('runtime read failed');
    clearLatestPersistenceError();
    expect(readLatestPersistenceError()).toBeNull();
    expect(readClientErrorLog()[0]).toMatchObject({
      source: 'persistence',
      context: 'runtime:read'
    });
  });

  it('notifies subscribers when the latest persistence error changes', () => {
    vi.stubGlobal('window', {
      localStorage: createStorageMock(),
      location: { href: 'http://localhost/polaris' }
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const listener = vi.fn();
    const unsubscribe = subscribeLatestPersistenceError(listener);

    reportPersistenceError({
      label: '[store:persist]',
      store: 'chat',
      operation: 'read'
    }, new Error('chat read failed'));
    clearLatestPersistenceError();
    unsubscribe();
    reportPersistenceError({
      label: '[store:persist]',
      store: 'chat',
      operation: 'write'
    }, new Error('after unsubscribe'));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      store: 'chat',
      operation: 'read',
      message: 'chat read failed'
    });
    expect(listener.mock.calls[1]?.[0]).toBeNull();
  });
});
