import { describe, expect, it } from 'vitest';
import {
  BUCKET_ORDER,
  classifyKvKey,
  classifyLocalStorageKey,
  estimateLocalDataBytes,
  textBytes
} from './buckets';

describe('estimateLocalDataBytes', () => {
  it('counts string and blob payloads by byte length', () => {
    expect(estimateLocalDataBytes('hello')).toBe(5);
    expect(estimateLocalDataBytes(new Blob(['hello']))).toBe(5);
  });

  it('serializes structured values before measuring', () => {
    expect(estimateLocalDataBytes({ a: 1 })).toBe(textBytes('{"a":1}'));
  });
});

describe('classifyKvKey', () => {
  it('routes chat, collection, persona, runtime, and space keys to their buckets', () => {
    expect(classifyKvKey('chat-catalog-v1')).toBe('chat');
    expect(classifyKvKey('chat-messages-v2:c-1')).toBe('chat');
    expect(classifyKvKey('collection-state-v2')).toBe('collection');
    expect(classifyKvKey('workspace-reference-doc-content-v1:doc')).toBe('collection');
    expect(classifyKvKey('persona-state-v2')).toBe('persona');
    expect(classifyKvKey('memory-vector-index-meta-v1:pharos')).toBe('persona');
    expect(classifyKvKey('runtime-providers-v2')).toBe('runtime');
    expect(classifyKvKey('space-theme-state-v1')).toBe('space');
  });

  it('falls back to other for unknown keys', () => {
    expect(classifyKvKey('local-data-v1:row:collection:card:x')).toBe('other');
    expect(classifyKvKey('something-else')).toBe('other');
  });
});

describe('classifyLocalStorageKey', () => {
  it('separates diagnostics, space, runtime, and chat mirrors', () => {
    expect(classifyLocalStorageKey('polaris-request-debug-log')).toBe('diagnostics');
    expect(classifyLocalStorageKey('polaris-space-store-v1')).toBe('space');
    expect(classifyLocalStorageKey('polaris-developer-mode')).toBe('runtime');
    expect(classifyLocalStorageKey('polaris-chat-index-v2-mirror')).toBe('chat');
    expect(classifyLocalStorageKey('polaris-chat-messages-v2-mirror:c-1')).toBe('chat');
    expect(classifyLocalStorageKey('whatever')).toBe('other');
  });
});

describe('BUCKET_ORDER', () => {
  it('lists every bucket once', () => {
    expect(new Set(BUCKET_ORDER).size).toBe(BUCKET_ORDER.length);
    expect(BUCKET_ORDER).toContain('assets');
    expect(BUCKET_ORDER).toContain('other');
  });
});
