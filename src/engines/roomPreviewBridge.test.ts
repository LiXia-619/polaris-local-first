import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import { injectRoomPreviewBridge } from './roomPreviewBridge';

function extractInjectedScript(html: string) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Injected bridge script not found');
  return match[1];
}

function runInjectedBridge(initialState: Record<string, unknown> = {}) {
  const injected = injectRoomPreviewBridge(
    '<!doctype html><html><head></head><body></body></html>',
    'project:demo',
    initialState
  );
  const messages: Array<{ type?: string; state?: unknown; flush?: boolean }> = [];
  const listeners = new Map<string, Array<(event?: unknown) => void>>();
  const windowStub = {
    addEventListener(name: string, listener: (event?: unknown) => void) {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    },
    dispatchEvent() {}
  };
  const documentStub = {
    hidden: false,
    visibilityState: 'visible',
    readyState: 'complete',
    addEventListener() {},
    querySelectorAll() {
      return [];
    }
  };

  vm.runInNewContext(extractInjectedScript(injected), {
    window: windowStub,
    document: documentStub,
    parent: {
      postMessage(message: { type?: string; state?: unknown; flush?: boolean }) {
        messages.push(message);
      }
    },
    CustomEvent: class CustomEvent {
      constructor(public name: string, public init?: unknown) {}
    },
    HTMLElement: class HTMLElement {},
    HTMLInputElement: class HTMLInputElement {},
    HTMLTextAreaElement: class HTMLTextAreaElement {},
    HTMLSelectElement: class HTMLSelectElement {},
    MutationObserver: undefined,
    setTimeout() {
      return 0;
    },
    Object,
    JSON,
    Array,
    Boolean,
    String,
    Promise,
    console
  });

  return {
    messages,
    windowStub: windowStub as typeof windowStub & {
      PolarisRoom: {
        getState: () => Record<string, unknown>;
        patchState: (patch: Record<string, unknown>) => Record<string, unknown>;
      };
      localStorage: Storage;
      sessionStorage: Storage;
    }
  };
}

describe('roomPreviewBridge', () => {
  it('injects the bridge into head when a full document is present', () => {
    const html = '<!doctype html><html><head><title>Demo</title></head><body><textarea id="diary"></textarea></body></html>';
    const injected = injectRoomPreviewBridge(html, 'card-1');

    expect(injected).toContain('"card-1"');
    expect(injected).toContain('window.PolarisRoom = api;');
    expect(injected).toContain("Object.defineProperty(window, propertyName");
    expect(injected).toContain("installStorageShim('localStorage', LOCAL_STORAGE_BUCKET_KEY);");
    expect(injected).toContain("installStorageShim('sessionStorage', SESSION_STORAGE_BUCKET_KEY);");
    expect(injected.indexOf('window.PolarisRoom = api;')).toBeLessThan(injected.indexOf('<title>Demo</title>'));
  });

  it('injects the bridge into body when head is missing', () => {
    const html = '<body><input id="note" /></body>';
    const injected = injectRoomPreviewBridge(html, 'card-2');

    expect(injected).toContain('polaris-room-bridge');
    expect(injected.indexOf('"card-2"')).toBeLessThan(injected.indexOf('<input id="note" />'));
  });

  it('prepends the bridge for html fragments', () => {
    const html = '<section contenteditable="true">hello</section>';
    const injected = injectRoomPreviewBridge(html, 'card-3');

    expect(injected.startsWith('<script>')).toBe(true);
    expect(injected).toContain('data-polaris-persist');
    expect(injected).toContain('<section contenteditable="true">hello</section>');
  });

  it('reapplies hydrated state to fields that were already bound earlier', () => {
    const html = '<!doctype html><html><body><textarea id="diary"></textarea></body></html>';
    const injected = injectRoomPreviewBridge(html, 'card-4');

    expect(injected).toContain('function syncElementFromState(element)');
    expect(injected).toContain('syncPersistedFields(document);');
    expect(injected).toContain("if (data.type !== 'hydrate') return;");
  });

  it('inlines initial room state so project scripts can read persisted storage on first load', () => {
    const html = '<!doctype html><html><head></head><body></body></html>';
    const injected = injectRoomPreviewBridge(html, 'card-5', {
      __polarisStorage: {
        dinamicu_posts: '{"posts":[{"id":1}]}'
      },
      __polarisSessionStorage: {
        draft: 'hello'
      }
    });

    expect(injected).toContain('var INITIAL_STATE = {"__polarisStorage":{"dinamicu_posts":"{\\"posts\\":[{\\"id\\":1}]}"},"__polarisSessionStorage":{"draft":"hello"}};');
    expect(injected).toContain('var roomState = normalizeState(INITIAL_STATE);');
    expect(injected).toContain('function getStorageBucket(bucketKey)');
  });

  it('hydrates saved room state and storage shims when a preview is opened again', () => {
    const firstRun = runInjectedBridge();
    firstRun.windowStub.localStorage.setItem('notes', 'remember me');
    firstRun.windowStub.sessionStorage.setItem('scratch', 'temporary tab');
    firstRun.windowStub.PolarisRoom.patchState({ view: { activeTab: 'notes' } });

    const savedState = [...firstRun.messages].reverse().find((message) => message.type === 'save')?.state;
    expect(savedState).toMatchObject({
      __polarisStorage: { notes: 'remember me' },
      __polarisSessionStorage: { scratch: 'temporary tab' },
      view: { activeTab: 'notes' }
    });

    const reopened = runInjectedBridge(savedState as Record<string, unknown>);

    expect(reopened.windowStub.localStorage.getItem('notes')).toBe('remember me');
    expect(reopened.windowStub.sessionStorage.getItem('scratch')).toBe('temporary tab');
    expect(reopened.windowStub.PolarisRoom.getState()).toMatchObject({
      __polarisStorage: { notes: 'remember me' },
      __polarisSessionStorage: { scratch: 'temporary tab' },
      view: { activeTab: 'notes' }
    });
  });

  it('marks hidden-page room saves for immediate host flush', () => {
    const injected = injectRoomPreviewBridge('<!doctype html><html><head></head><body></body></html>', 'card-6');
    const messages: Array<{ type?: string; state?: unknown; flush?: boolean }> = [];
    const listeners = new Map<string, Array<(event?: unknown) => void>>();
    const windowStub = {
      addEventListener(name: string, listener: (event?: unknown) => void) {
        listeners.set(name, [...(listeners.get(name) ?? []), listener]);
      },
      dispatchEvent() {}
    };
    const documentStub = {
      hidden: true,
      visibilityState: 'hidden',
      readyState: 'complete',
      addEventListener() {},
      querySelectorAll() {
        return [];
      }
    };

    vm.runInNewContext(extractInjectedScript(injected), {
      window: windowStub,
      document: documentStub,
      parent: {
        postMessage(message: { type?: string; state?: unknown; flush?: boolean }) {
          messages.push(message);
        }
      },
      CustomEvent: class CustomEvent {
        constructor(public name: string, public init?: unknown) {}
      },
      HTMLElement: class HTMLElement {},
      HTMLInputElement: class HTMLInputElement {},
      HTMLTextAreaElement: class HTMLTextAreaElement {},
      HTMLSelectElement: class HTMLSelectElement {},
      MutationObserver: undefined,
      setTimeout() {
        return 0;
      },
      Object,
      JSON,
      Array,
      Boolean,
      String,
      Promise,
      console
    });

    const room = (windowStub as unknown as {
      PolarisRoom: { patchState: (patch: Record<string, unknown>) => void };
    }).PolarisRoom;
    room.patchState({ groups: [{ id: 'g-1', lines: ['alpha', 'beta'] }] });

    expect(messages[messages.length - 1]).toMatchObject({
      type: 'save',
      flush: true,
      state: { groups: [{ id: 'g-1', lines: ['alpha', 'beta'] }] }
    });
  });
});
