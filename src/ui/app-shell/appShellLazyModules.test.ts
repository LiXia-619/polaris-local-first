import { describe, expect, it } from 'vitest';
import { createCachedLoader } from './appShellLazyModules';

describe('createCachedLoader', () => {
  it('shares the pending request for concurrent callers', async () => {
    let calls = 0;
    const loader = createCachedLoader(async () => {
      calls += 1;
      return { value: 'loaded' };
    });

    const first = loader();
    const second = loader();

    await expect(first).resolves.toEqual({ value: 'loaded' });
    await expect(second).resolves.toEqual({ value: 'loaded' });
    expect(calls).toBe(1);
  });

  it('clears a rejected request so later callers can retry', async () => {
    let calls = 0;
    const loader = createCachedLoader(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('Load failed');
      }
      return { value: 'loaded' };
    });

    await expect(loader()).rejects.toThrow('Load failed');
    await expect(loader()).resolves.toEqual({ value: 'loaded' });
    expect(calls).toBe(2);
  });
});
