import { describe, expect, it, vi } from 'vitest';
import {
  MemoryFreeProviderRateLimitStore,
  UpstashFreeProviderRateLimitStore,
  buildFreeProviderRateLimitKey,
  consumeFreeProviderRateLimit,
  createFreeProviderRateLimitStore,
  getFreeProviderRateLimitState,
  resolveFreeProviderDailyLimit
} from './freeProviderRateLimit';

describe('free provider rate limit', () => {
  it('tracks usage by UTC day and user id', async () => {
    const store = new MemoryFreeProviderRateLimitStore();
    const now = new Date('2026-04-24T12:00:00.000Z');

    await expect(getFreeProviderRateLimitState({
      store,
      userId: 'device-a',
      limit: 2,
      now
    })).resolves.toMatchObject({
      allowed: true,
      remaining: 2
    });

    await expect(consumeFreeProviderRateLimit({
      store,
      userId: 'device-a',
      limit: 2,
      now
    })).resolves.toMatchObject({
      allowed: true,
      remaining: 1
    });

    await consumeFreeProviderRateLimit({ store, userId: 'device-a', limit: 2, now });
    await expect(consumeFreeProviderRateLimit({
      store,
      userId: 'device-a',
      limit: 2,
      now
    })).resolves.toMatchObject({
      allowed: false,
      remaining: 0
    });

    await expect(getFreeProviderRateLimitState({
      store,
      userId: 'device-a',
      limit: 2,
      now: new Date('2026-04-25T00:01:00.000Z')
    })).resolves.toMatchObject({
      allowed: true,
      remaining: 2
    });
  });

  it('uses a persistent Upstash store when Redis REST env is configured', () => {
    const store = createFreeProviderRateLimitStore({
      UPSTASH_REDIS_REST_URL: 'https://redis.example.com/',
      UPSTASH_REDIS_REST_TOKEN: 'token'
    });

    expect(store.mode).toBe('upstash');
  });

  it('sends atomic increment and expiry through Upstash pipeline', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([
      { result: 3 },
      { result: 1 }
    ]), { status: 200 }));
    const store = new UpstashFreeProviderRateLimitStore({
      url: 'https://redis.example.com/',
      token: 'token',
      fetchImpl
    });

    const count = await store.increment('polaris:test:key', 120);

    expect(count).toBe(3);
    expect(fetchImpl).toHaveBeenCalledWith('https://redis.example.com/pipeline', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify([
        ['INCR', 'polaris:test:key'],
        ['EXPIRE', 'polaris:test:key', 120]
      ])
    }));
  });

  it('resolves daily limit from env without inventing a second cap', () => {
    expect(resolveFreeProviderDailyLimit({})).toBe(30);
    expect(resolveFreeProviderDailyLimit({ POLARIS_CHAT_DAILY_LIMIT: '42' })).toBe(42);
    expect(resolveFreeProviderDailyLimit({ POLARIS_CHAT_DAILY_LIMIT: 'nope' })).toBe(30);
  });

  it('builds stable date-scoped keys', () => {
    expect(buildFreeProviderRateLimitKey('device a', new Date('2026-04-24T23:59:00.000Z'), 'prefix'))
      .toBe('prefix:2026-04-24:device%20a');
  });
});
