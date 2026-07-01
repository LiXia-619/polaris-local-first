import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAppRuntimeLogEntries,
  readAppRuntimeLogEntries,
  recordAppRuntimeLogEntry
} from './appRuntimeLog';

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

describe('app runtime log', () => {
  afterEach(() => {
    clearAppRuntimeLogEntries();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('batches hot-path runtime log writes off the current turn', () => {
    vi.useFakeTimers();
    const storage = createStorageMock();
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn(),
      setTimeout,
      clearTimeout
    });
    vi.stubGlobal('CustomEvent', class CustomEvent {
      constructor(public type: string) {}
    });

    recordAppRuntimeLogEntry({
      at: 1,
      kind: 'chat-send-performance',
      title: '聊天发送 · 开始',
      detail: 'trace one'
    });
    recordAppRuntimeLogEntry({
      at: 2,
      kind: 'chat-send-performance',
      title: '聊天发送 · 请求上下文就绪',
      detail: 'trace one · context'
    });

    expect(storage.setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(120);

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(readAppRuntimeLogEntries()).toEqual([
      expect.objectContaining({ title: '聊天发送 · 开始' }),
      expect.objectContaining({ title: '聊天发送 · 请求上下文就绪' })
    ]);
  });

  it('flushes pending entries before reads', () => {
    vi.useFakeTimers();
    const storage = createStorageMock();
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn(),
      setTimeout,
      clearTimeout
    });
    vi.stubGlobal('CustomEvent', class CustomEvent {
      constructor(public type: string) {}
    });

    recordAppRuntimeLogEntry({
      at: 3,
      kind: 'startup',
      title: '启动 · shell ready',
      detail: 'ready'
    });

    expect(readAppRuntimeLogEntries()).toEqual([
      expect.objectContaining({ title: '启动 · shell ready' })
    ]);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});
