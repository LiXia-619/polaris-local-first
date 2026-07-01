import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('pageLifecycleFlush', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('shares one page lifecycle listener pair across registered flush handlers', async () => {
    const addWindowListener = vi.fn();
    const removeWindowListener = vi.fn();
    const addDocumentListener = vi.fn();
    const removeDocumentListener = vi.fn();
    vi.stubGlobal('window', {
      addEventListener: addWindowListener,
      removeEventListener: removeWindowListener
    });
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: addDocumentListener,
      removeEventListener: removeDocumentListener
    });

    const { registerPageLifecycleFlush } = await import('./pageLifecycleFlush');
    const first = vi.fn();
    const second = vi.fn();

    const unregisterFirst = registerPageLifecycleFlush(first);
    const unregisterSecond = registerPageLifecycleFlush(second);

    expect(addWindowListener).toHaveBeenCalledTimes(1);
    expect(addDocumentListener).toHaveBeenCalledTimes(1);

    const pagehideHandler = addWindowListener.mock.calls[0]?.[1] as () => void;
    pagehideHandler();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unregisterFirst();
    expect(removeWindowListener).not.toHaveBeenCalled();

    unregisterSecond();
    expect(removeWindowListener).toHaveBeenCalledTimes(1);
    expect(removeDocumentListener).toHaveBeenCalledTimes(1);
  });

  it('flushes on both backgrounding and foreground visibility changes', async () => {
    const addDocumentListener = vi.fn();
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: addDocumentListener,
      removeEventListener: vi.fn()
    });

    const { registerPageLifecycleFlush } = await import('./pageLifecycleFlush');
    const flush = vi.fn();
    registerPageLifecycleFlush(flush);

    const visibilityHandler = addDocumentListener.mock.calls[0]?.[1] as () => void;
    visibilityHandler();
    expect(flush).toHaveBeenCalledTimes(1);

    vi.stubGlobal('document', {
      hidden: true,
      addEventListener: addDocumentListener,
      removeEventListener: vi.fn()
    });
    visibilityHandler();
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('waits for async flush handlers when called directly', async () => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    vi.stubGlobal('document', {
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const { flushPageLifecycleHandlers, registerPageLifecycleFlush } = await import('./pageLifecycleFlush');
    const order: string[] = [];
    registerPageLifecycleFlush(async () => {
      await Promise.resolve();
      order.push('async');
    });
    registerPageLifecycleFlush(() => {
      order.push('sync');
    });

    await flushPageLifecycleHandlers();

    expect(order).toEqual(['sync', 'async']);
  });
});
