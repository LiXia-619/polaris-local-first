import { beforeEach, describe, expect, it, vi } from 'vitest';

function createStorageMock(initialEntries: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initialEntries));
  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    })
  };
}

describe('client error log', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('records compact diagnostics without touching legacy chat mirror keys', async () => {
    const storage = createStorageMock({
      'polaris-chat-index-v2-mirror': 'index',
      'polaris-chat-messages-v2-mirror:c-1': 'messages',
      'polaris-client-error-log': JSON.stringify([
        { id: 'old-1', at: '1', source: 'boundary', message: 'old' },
        null,
        { id: 'old-2', at: '2', source: 'window-error', message: 'x'.repeat(600) }
      ])
    });
    vi.stubGlobal('window', {
      localStorage: storage,
      location: { href: 'https://example.test/app' },
      addEventListener: vi.fn()
    });
    const { recordClientError, readClientErrorLog } = await import('./clientErrorLog');

    recordClientError(new Error('boom'), 'unhandled-rejection');

    expect(storage.getItem('polaris-chat-index-v2-mirror')).toBe('index');
    expect(storage.getItem('polaris-chat-messages-v2-mirror:c-1')).toBe('messages');
    const entries = readClientErrorLog();
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      source: 'unhandled-rejection',
      message: 'boom',
      url: 'https://example.test/app'
    });
    expect(entries[2]?.message).toHaveLength(500);
  });

  it('keeps only the newest five stored diagnostics', async () => {
    const storage = createStorageMock({
      'polaris-client-error-log': JSON.stringify(Array.from({ length: 8 }, (_, index) => ({
        id: `old-${index}`,
        at: String(index),
        source: 'boundary',
        message: `old ${index}`
      })))
    });
    vi.stubGlobal('window', {
      localStorage: storage,
      location: { href: 'https://example.test/app' },
      addEventListener: vi.fn()
    });
    const { recordClientError, readClientErrorLog } = await import('./clientErrorLog');

    recordClientError('newest', 'persistence');

    const entries = readClientErrorLog();
    expect(entries.map((entry) => entry.message)).toEqual([
      'newest',
      'old 0',
      'old 1',
      'old 2',
      'old 3'
    ]);
  });
});
