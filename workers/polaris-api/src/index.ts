const SILICONFLOW_CHAT_COMPLETIONS_URL =
  "https://api.siliconflow.cn/v1/chat/completions";
const MIMO_CHAT_COMPLETIONS_URL =
  "https://api.xiaomimimo.com/v1/chat/completions";
const RATE_LIMIT_TTL_SECONDS = 48 * 60 * 60;
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(?:[a-z0-9-]+\.)*vercel\.app$/i,
];

interface Env {
  MIMO_API_KEY?: string;
  SILICONFLOW_API_KEY: string;
  DAILY_LIMIT?: string;
  DEFAULT_MODEL?: string;
  RATE_LIMIT: KVNamespace;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: {
      expirationTtl?: number;
    },
  ): Promise<void>;
}

interface ChatCompletionRequest {
  model?: string;
  [key: string]: unknown;
}

const FREE_PROVIDER_MODELS = [
  "mimo-v2-pro",
  "moonshotai/Kimi-K2-Instruct",
  "moonshotai/Kimi-K2-Thinking",
  "Qwen/Qwen2.5-72B-Instruct",
  "Qwen/Qwen3-235B-A22B-Instruct-2507",
  "Qwen/Qwen3-235B-A22B-Thinking-2507",
  "deepseek-ai/DeepSeek-V3",
  "deepseek-ai/DeepSeek-R1",
  "Pro/MiniMaxAI/MiniMax-M2.5",
] as const;

interface RateLimitState {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = buildCorsHeaders(request);
    if (request.method === "OPTIONS") {
      return handlePreflight(corsHeaders);
    }

    if (corsHeaders === null) {
      return json(
        {
          error: {
            message: "Origin not allowed.",
            type: "forbidden",
          },
        },
        403,
      );
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return withCors(
        json(
          {
            ok: true,
            limit: getDailyLimit(env),
            model: getDefaultModel(env),
          },
          200,
        ),
        corsHeaders,
      );
    }

    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      return handleChatCompletions(request, env, corsHeaders);
    }

    return withCors(
      json(
        {
          error: {
            message: "Not found.",
            type: "not_found",
          },
        },
        404,
      ),
      corsHeaders,
    );
  },
};

async function handleChatCompletions(
  request: Request,
  env: Env,
  corsHeaders: Headers,
): Promise<Response> {
  const rateLimit = await checkAndIncrementRateLimit(request, env);
  if (!rateLimit.allowed) {
    return withCors(
      json(
        {
          error: {
            message: "今天的对话次数用完了，明天再来吧 ✨",
            type: "rate_limit",
          },
        },
        429,
      ),
      attachRateLimitHeaders(corsHeaders, rateLimit),
    );
  }

  let payload: ChatCompletionRequest;
  try {
    payload = (await request.json()) as ChatCompletionRequest;
  } catch {
    return withCors(
      json(
        {
          error: {
            message: "Request body must be valid JSON.",
            type: "invalid_request_error",
          },
        },
        400,
      ),
      attachRateLimitHeaders(corsHeaders, rateLimit),
    );
  }

  const model = resolveRequestedModel(payload.model, env);
  const mimoRoute = model.toLowerCase().startsWith("mimo-");
  const upstreamApiKey = mimoRoute
    ? env.MIMO_API_KEY?.trim()
    : env.SILICONFLOW_API_KEY?.trim();
  if (!upstreamApiKey) {
    return withCors(
      json(
        {
          error: {
            message: mimoRoute
              ? "MIMO_API_KEY is not configured."
              : "SILICONFLOW_API_KEY is not configured.",
            type: "configuration_error",
          },
        },
        500,
      ),
      corsHeaders,
    );
  }

  const upstreamPayload = {
    ...payload,
    model,
  };

  const upstreamResponse = await fetch(
    mimoRoute ? MIMO_CHAT_COMPLETIONS_URL : SILICONFLOW_CHAT_COMPLETIONS_URL,
    {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstreamApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamPayload),
    },
  );

  const responseHeaders = copyResponseHeaders(upstreamResponse.headers);
  responseHeaders.set("Cache-Control", "no-store");

  return withCors(
    new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: attachRateLimitHeaders(responseHeaders, rateLimit),
    }),
    corsHeaders,
  );
}

async function checkAndIncrementRateLimit(
  request: Request,
  env: Env,
): Promise<RateLimitState> {
  const limit = getDailyLimit(env);
  const userId = getUserId(request);
  const date = new Date().toISOString().slice(0, 10);
  const key = `ratelimit:${userId}:${date}`;

  const rawCount = await env.RATE_LIMIT.get(key);
  const currentCount = Number.parseInt(rawCount ?? "0", 10) || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
    };
  }

  const nextCount = currentCount + 1;
  await env.RATE_LIMIT.put(key, String(nextCount), {
    expirationTtl: RATE_LIMIT_TTL_SECONDS,
  });

  return {
    allowed: true,
    remaining: Math.max(0, limit - nextCount),
    limit,
  };
}

function getUserId(request: Request): string {
  const deviceId = request.headers.get("X-Polaris-Device-Id")?.trim();
  if (deviceId) {
    return deviceId;
  }

  const ip =
    request.headers.get("CF-Connecting-IP")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (ip) {
    return ip;
  }

  return "anonymous";
}

function getDailyLimit(env: Env): number {
  const parsed = Number.parseInt(env.DAILY_LIMIT ?? "30", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function getDefaultModel(env: Env): string {
  const requested = env.DEFAULT_MODEL?.trim();
  if (requested && FREE_PROVIDER_MODELS.includes(requested as typeof FREE_PROVIDER_MODELS[number])) {
    return requested;
  }
  return "mimo-v2-pro";
}

function resolveRequestedModel(rawModel: unknown, env: Env): string {
  if (typeof rawModel !== "string") {
    return getDefaultModel(env);
  }

  const normalized = rawModel.trim();
  if (!normalized) {
    return getDefaultModel(env);
  }

  return FREE_PROVIDER_MODELS.includes(normalized as typeof FREE_PROVIDER_MODELS[number])
    ? normalized
    : getDefaultModel(env);
}

function buildCorsHeaders(request: Request): Headers | null {
  const origin = request.headers.get("Origin");
  const headers = new Headers();

  if (!origin) {
    headers.set("Vary", "Origin");
    return headers;
  }

  if (!isAllowedOrigin(origin)) {
    return null;
  }

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", getAllowedRequestHeaders(request));
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function getAllowedRequestHeaders(request: Request): string {
  const requestedHeaders = request.headers.get("Access-Control-Request-Headers");
  return requestedHeaders || "Content-Type, X-Polaris-Device-Id";
}

function handlePreflight(corsHeaders: Headers | null): Response {
  if (corsHeaders === null) {
    return json(
      {
        error: {
          message: "Origin not allowed.",
          type: "forbidden",
        },
      },
      403,
    );
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function attachRateLimitHeaders(
  headers: Headers,
  rateLimit: RateLimitState,
): Headers {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("X-RateLimit-Limit", String(rateLimit.limit));
  nextHeaders.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  return nextHeaders;
}

function withCors(response: Response, corsHeaders: Headers): Response {
  const headers = new Headers(response.headers);

  corsHeaders.forEach((value, key) => headers.set(key, value));

  headers.set("Cache-Control", headers.get("Cache-Control") ?? "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function copyResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (key.toLowerCase() === "access-control-allow-origin") {
      return;
    }
    headers.set(key, value);
  });
  return headers;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
