import { beforeEach, describe, expect, it, vi } from 'vitest';

const kvGet = vi.fn();
const kvSet = vi.fn();
const reportPersistenceError = vi.fn();

vi.mock('../infrastructure/persistence', () => ({
  kvGet,
  kvSet
}));

vi.mock('../infrastructure/persistenceDiagnostics', () => ({
  reportPersistenceError
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('roomStatePersistence', () => {
  beforeEach(() => {
    vi.useRealTimers();
    kvGet.mockReset();
    kvSet.mockReset();
    reportPersistenceError.mockReset();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('builds stable storage keys per room id', async () => {
    const module = await import('./roomStatePersistence');
    expect(module.buildRoomStateStorageKey('card-1')).toBe('room-state:card-1');
  });

  it('normalizes non-object payloads into empty room state', async () => {
    kvGet.mockResolvedValueOnce(['bad']);
    const module = await import('./roomStatePersistence');

    await expect(module.readRoomState('card-2')).resolves.toEqual({});
  });

  it('keeps newer in-memory edits when async hydration resolves late', async () => {
    const pending = deferred<Record<string, unknown>>();
    kvGet.mockReturnValueOnce(pending.promise);
    const module = await import('./roomStatePersistence');

    const hydration = module.ensureRoomState('card-3');
    module.updateRoomState('card-3', { draft: 'new' });
    pending.resolve({ draft: 'old' });

    await expect(hydration).resolves.toEqual({ draft: 'new' });
    expect(module.getCachedRoomState('card-3')).toEqual({ draft: 'new' });
  });

  it('flushes pending room state immediately before the debounce timer fires', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    kvSet.mockResolvedValue(undefined);
    const module = await import('./roomStatePersistence');

    module.updateRoomState('card-4', { draft: 'queued' });
    expect(kvSet).not.toHaveBeenCalled();

    await module.flushRoomState('card-4');
    expect(kvSet).toHaveBeenCalledTimes(1);
    expect(kvSet).toHaveBeenLastCalledWith('room-state:card-4', { draft: 'queued' });

    await vi.advanceTimersByTimeAsync(200);
    expect(kvSet).toHaveBeenCalledTimes(1);
  });

  it('reports debounced room state write failures without leaking rejections', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    const error = new Error('room state write failed');
    kvSet.mockRejectedValueOnce(error);
    const module = await import('./roomStatePersistence');

    module.updateRoomState('card-5', { draft: 'queued' });
    await vi.runOnlyPendingTimersAsync();

    expect(reportPersistenceError).toHaveBeenCalledWith(
      { label: '[room-state:persist]', store: 'room-state', operation: 'debounced-write' },
      error
    );
  });

  it('reports lifecycle room state flush failures without rejecting the caller', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    const error = new Error('room state flush failed');
    kvSet.mockRejectedValueOnce(error);
    const module = await import('./roomStatePersistence');

    module.updateRoomState('card-6', { draft: 'queued' });
    await expect(module.flushRoomState('card-6')).resolves.toBeUndefined();

    expect(reportPersistenceError).toHaveBeenCalledWith(
      { label: '[room-state:persist]', store: 'room-state', operation: 'flush' },
      error
    );
    await vi.advanceTimersByTimeAsync(200);
    expect(kvSet).toHaveBeenCalledTimes(1);
  });

  it('does not install its own page lifecycle listeners', async () => {
    vi.useFakeTimers();
    const addEventListener = vi.fn();
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
      addEventListener,
      removeEventListener: vi.fn()
    });
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener,
      removeEventListener: vi.fn()
    });
    const module = await import('./roomStatePersistence');

    module.updateRoomState('card-7', { draft: 'queued' });

    expect(addEventListener).not.toHaveBeenCalled();
  });
});
