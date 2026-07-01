import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroySandboxFrame, prewarmRunCodeSandbox, runCodeInSandbox } from './codeSandbox';

type FakeIframe = {
  parentElement: { removeChild: (node: FakeIframe) => void } | null;
  contentWindow: {
    postMessage: (message: { code: string }, targetOrigin: string, transfer: MessagePort[]) => void;
  } | null;
  srcdoc: string;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (name: string, listener: () => void, options?: { once?: boolean }) => void;
  dispatchLoad: () => void;
};

function installSandboxDom() {
  const listeners = new Map<string, Array<() => void>>();
  const iframe: FakeIframe = {
    parentElement: null,
    contentWindow: {
      postMessage: vi.fn((message, _targetOrigin, transfer) => {
        const replyPort = transfer[0];
        replyPort.postMessage({
          ok: true,
          returnValue: message.code,
          logs: []
        });
      })
    },
    srcdoc: '',
    setAttribute: vi.fn(),
    addEventListener(name, listener, options) {
      const bucket = listeners.get(name) ?? [];
      if (options?.once) {
        bucket.push(() => {
          listener();
          const next = (listeners.get(name) ?? []).filter((entry) => entry !== wrapped);
          listeners.set(name, next);
        });
        const wrapped = bucket[bucket.length - 1];
        listeners.set(name, bucket);
        return;
      }
      bucket.push(listener);
      listeners.set(name, bucket);
    },
    dispatchLoad() {
      const bucket = listeners.get('load') ?? [];
      bucket.slice().forEach((listener) => listener());
    }
  };

  const removeChild = vi.fn((node: FakeIframe) => {
    if (node === iframe) {
      iframe.parentElement = null;
    }
  });
  const body = {
    appendChild: vi.fn((node: FakeIframe) => {
      node.parentElement = body as unknown as { removeChild: (node: FakeIframe) => void };
      return node;
    }),
    removeChild
  };

  vi.stubGlobal('window', {
    localStorage: {
      getItem: vi.fn(() => 'safe'),
      setItem: vi.fn()
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  });
  vi.stubGlobal('document', {
    body,
    createElement: vi.fn(() => iframe),
    getElementById: vi.fn(() => null)
  });

  return { iframe, body };
}

afterEach(() => {
  destroySandboxFrame();
  vi.unstubAllGlobals();
});

describe('runCodeInSandbox', () => {
  it('can prewarm the sandbox iframe before the first execution', async () => {
    const { iframe, body } = installSandboxDom();

    const warmPromise = prewarmRunCodeSandbox();
    await Promise.resolve();

    expect(body.appendChild).toHaveBeenCalledTimes(1);
    expect(iframe.contentWindow?.postMessage).not.toHaveBeenCalled();

    iframe.dispatchLoad();
    await warmPromise;
  });

  it('waits for the sandbox iframe load before sending the first execution message', async () => {
    const { iframe } = installSandboxDom();

    const resultPromise = runCodeInSandbox('return 42;');
    await Promise.resolve();

    expect(iframe.contentWindow?.postMessage).not.toHaveBeenCalled();

    iframe.dispatchLoad();
    const result = await resultPromise;

    expect(iframe.contentWindow?.postMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      returnValue: 'return 42;',
      logs: []
    });
  });
});
