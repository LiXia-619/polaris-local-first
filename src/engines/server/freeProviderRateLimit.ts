export const DEFAULT_FREE_PROVIDER_DAILY_LIMIT = 30;

export type RateLimitEnv = Record<string, string | undefined>;

export type FreeProviderRateLimitStore = {
  mode: 'memory' | 'upstash';
  getCount: (key: string, now: Date) => Promise<number>;
  increment: (key: string, ttlSeconds: number, now: Date) => Promise<number>;
};

export type FreeProviderRateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type MemoryRateLimitEntry = {
  count: number;
  expiresAtMs: number;
};

const DEFAULT_KEY_PREFIX = 'polaris:free-provider-chat';

function parsePositiveInteger(raw: string | undefined, fallback: number) {
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getUtcDay(now: Date) {
  return now.toISOString().slice(0, 10);
}

function getSecondsUntilNextUtcDay(now: Date) {
  const nextUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((nextUtcDay - now.getTime()) / 1000) + 60);
}

function getUpstashConfig(env: RateLimitEnv) {
  const url = (env.POLARIS_RATE_LIMIT_REDIS_URL || env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/$/, '');
  const token = (env.POLARIS_RATE_LIMIT_REDIS_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  return url && token ? { url, token } : null;
}

function parseUpstashCount(raw: unknown) {
  if (raw === null || raw === undefined) return 0;
  const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Invalid Upstash rate limit count');
  }
  return value;
}

export function resolveFreeProviderDailyLimit(env: RateLimitEnv = {}) {
  return parsePositiveInteger(env.POLARIS_CHAT_DAILY_LIMIT, DEFAULT_FREE_PROVIDER_DAILY_LIMIT);
}

export function buildFreeProviderRateLimitKey(userId: string, now: Date, prefix = DEFAULT_KEY_PREFIX) {
  const normalizedUserId = encodeURIComponent(userId.trim() || 'anonymous');
  return `${prefix}:${getUtcDay(now)}:${normalizedUserId}`;
}

export class MemoryFreeProviderRateLimitStore implements FreeProviderRateLimitStore {
  readonly mode = 'memory' as const;

  private readonly entries = new Map<string, MemoryRateLimitEntry>();

  async getCount(key: string, now: Date) {
    const entry = this.entries.get(key);
    if (!entry) return 0;
    if (entry.expiresAtMs <= now.getTime()) {
      this.entries.delete(key);
      return 0;
    }
    return entry.count;
  }

  async increment(key: string, ttlSeconds: number, now: Date) {
    const current = await this.getCount(key, now);
    const nextCount = current + 1;
    this.entries.set(key, {
      count: nextCount,
      expiresAtMs: now.getTime() + ttlSeconds * 1000
    });
    return nextCount;
  }
}

export class UpstashFreeProviderRateLimitStore implements FreeProviderRateLimitStore {
  readonly mode = 'upstash' as const;

  private readonly url: string;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;

  constructor(config: { url: string; token: string; fetchImpl?: FetchLike }) {
    this.url = config.url.replace(/\/$/, '');
    this.token = config.token;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async getCount(key: string) {
    const response = await this.fetchImpl(`${this.url}/get/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });
    if (!response.ok) {
      throw new Error(`Upstash rate limit read failed: ${response.status}`);
    }
    const payload = await response.json() as { result?: unknown; error?: unknown };
    if (payload.error) {
      throw new Error(`Upstash rate limit read failed: ${String(payload.error)}`);
    }
    return parseUpstashCount(payload.result);
  }

  async increment(key: string, ttlSeconds: number) {
    const response = await this.fetchImpl(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, ttlSeconds]
      ])
    });
    if (!response.ok) {
      throw new Error(`Upstash rate limit write failed: ${response.status}`);
    }
    const payload = await response.json() as Array<{ result?: unknown; error?: unknown }>;
    const incrementResult = payload[0];
    if (!incrementResult || incrementResult.error) {
      throw new Error(`Upstash rate limit write failed: ${String(incrementResult?.error ?? 'missing increment result')}`);
    }
    return parseUpstashCount(incrementResult.result);
  }
}

export function createFreeProviderRateLimitStore(env: RateLimitEnv = {}, fetchImpl?: FetchLike): FreeProviderRateLimitStore {
  const upstash = getUpstashConfig(env);
  if (upstash) {
    return new UpstashFreeProviderRateLimitStore({ ...upstash, fetchImpl });
  }
  return new MemoryFreeProviderRateLimitStore();
}

export async function getFreeProviderRateLimitState(options: {
  store: FreeProviderRateLimitStore;
  userId: string;
  limit: number;
  now?: Date;
  prefix?: string;
}): Promise<FreeProviderRateLimitResult> {
  const now = options.now ?? new Date();
  const key = buildFreeProviderRateLimitKey(options.userId, now, options.prefix);
  const count = await options.store.getCount(key, now);
  return {
    allowed: count < options.limit,
    count,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count)
  };
}

export async function consumeFreeProviderRateLimit(options: {
  store: FreeProviderRateLimitStore;
  userId: string;
  limit: number;
  now?: Date;
  prefix?: string;
}): Promise<FreeProviderRateLimitResult> {
  const now = options.now ?? new Date();
  const key = buildFreeProviderRateLimitKey(options.userId, now, options.prefix);
  const count = await options.store.increment(key, getSecondsUntilNextUtcDay(now), now);
  return {
    allowed: count <= options.limit,
    count,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count)
  };
}
