import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRunCodeSandboxProfile,
  lockRunCodeSandbox,
  POLARIS_RUN_CODE_SANDBOX_MODE_EVENT,
  RUN_CODE_SANDBOX_UNLOCK_PASSPHRASE,
  unlockRunCodeSandbox
} from './runCodeSandboxMode';

function createLocalStorageMock() {
  const storage = new Map<string, string>();
  return {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key) ?? null : null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    }
  };
}

describe('runCodeSandboxMode', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to experimental mode and rejects a wrong passphrase', () => {
    vi.stubGlobal('window', {
      localStorage: createLocalStorageMock(),
      dispatchEvent: vi.fn()
    });

    expect(getRunCodeSandboxProfile()).toBe('experimental');
    expect(unlockRunCodeSandbox('不是这个')).toBe(false);
    expect(getRunCodeSandboxProfile()).toBe('experimental');
  });

  it('switches to experimental mode after the hidden passphrase and can lock back down to explicit safe mode', () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', {
      localStorage: createLocalStorageMock(),
      dispatchEvent
    });
    vi.stubGlobal('CustomEvent', class {
      type: string;

      constructor(type: string) {
        this.type = type;
      }
    });

    expect(unlockRunCodeSandbox(RUN_CODE_SANDBOX_UNLOCK_PASSPHRASE)).toBe('experimental');
    expect(getRunCodeSandboxProfile()).toBe('experimental');
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: POLARIS_RUN_CODE_SANDBOX_MODE_EVENT
    }));

    expect(lockRunCodeSandbox()).toBe(true);
    expect(getRunCodeSandboxProfile()).toBe('safe');
  });

  it('keeps an explicitly stored safe mode instead of falling back to experimental', () => {
    const storage = createLocalStorageMock();
    storage.setItem('polaris-run-code-sandbox-mode', 'safe');
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn()
    });

    expect(getRunCodeSandboxProfile()).toBe('safe');
  });

  it('ignores unknown profile storage and falls back to experimental mode', () => {
    const storage = createLocalStorageMock();
    storage.setItem('polaris-run-code-sandbox-mode', 'unsafe-profile');
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn()
    });

    expect(getRunCodeSandboxProfile()).toBe('experimental');
  });
});
