import {
  buildAssistantToolPrompt,
  extractAssistantToolActions
} from '../src/engines/assistantToolProtocol.ts';
import { SELECTOR_CATALOG, extractSelectorAliases } from '../src/config/themeSelectorCatalog.ts';
import {
  THEME_SURFACE_REGISTRY,
  findThemeSurfaceEntryByCode,
  findThemeSurfaceEntryByRef
} from '../src/config/themeSurfaceRegistry.ts';
import { extractOpenAiCompatibleReply } from '../src/engines/provider-runtime/providerRuntimeResponsePayload.ts';
import { resolveAssistantToolRequestTools } from '../src/engines/tool-protocol/assistantToolProtocolRequestTools.ts';

export function parseCsv(raw) {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function dedupe(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function ratio(hit, total) {
  if (!total) return 0;
  return Number(((hit / total) * 100).toFixed(1));
}

export function hasExecutableAction(entry) {
  return entry?.evaluation?.hasExecutableAction === true || entry?.evaluation?.hasTool === true;
}

export function buildExecutableActionMetrics(entries, options = {}) {
  const {
    resolveHasExecutableAction = hasExecutableAction
  } = options;
  const total = entries.length;
  const actionCompletionRate = ratio(entries.filter((entry) => resolveHasExecutableAction(entry)).length, total);

  return {
    actionCompletionRate,
    // Legacy alias kept so older readers do not break while we migrate wording.
    toolRate: actionCompletionRate
  };
}

export function buildExecutableTransportMetrics(entries, options = {}) {
  const {
    resolveHasExecutableAction = hasExecutableAction,
    resolveIssues = (entry) => entry?.issues ?? [],
    rateLimitedIssue = 'rate_limited'
  } = options;
  const total = entries.length;

  return {
    requestedNativeToolRate: ratio(entries.filter((entry) => entry?.requestedNativeTools).length, total),
    nativeToolCallRate: ratio(entries.filter((entry) => entry?.usedNativeToolCalls).length, total),
    nativeTextFallbackRate: ratio(
      entries.filter((entry) => entry?.requestedNativeTools && resolveHasExecutableAction(entry) && !entry?.usedNativeToolCalls).length,
      total
    ),
    nativeActionParseRate: ratio(entries.filter((entry) => entry?.nativeToolParseSucceeded).length, total),
    rateLimitedCount: entries.filter((entry) => resolveIssues(entry).includes(rateLimitedIssue)).length
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveValidationProviderMeta(api, explicitLabel) {
  const label = explicitLabel?.trim();
  if (label) {
    return {
      label,
      apiHost: tryResolveApiHost(api)
    };
  }

  const apiHost = tryResolveApiHost(api);
  if (!apiHost) {
    return {
      label: 'custom',
      apiHost: null
    };
  }

  if (apiHost.includes('siliconflow.cn')) {
    return {
      label: 'siliconflow',
      apiHost
    };
  }

  if (apiHost.includes('openrouter.ai')) {
    return {
      label: 'openrouter',
      apiHost
    };
  }

  if (apiHost.includes('openai.com')) {
    return {
      label: 'openai-compatible',
      apiHost
    };
  }

  return {
    label: apiHost,
    apiHost
  };
}

function tryResolveApiHost(api) {
  try {
    return new URL(api).host;
  } catch {
    return null;
  }
}

export function resolveTransports(raw, fallback = 'text,native') {
  const transports = parseCsv(raw || fallback);
  const supported = new Set(['text', 'native']);
  transports.forEach((transport) => {
    if (!supported.has(transport)) {
      throw new Error(`unknown transport: ${transport}`);
    }
  });
  return transports;
}

export function buildValidationContext({
  activeWorld,
  collectionShelf,
  modelTier,
  lastUserMessage,
  themeFocus,
  themeToolMode = 'stable',
  themeContextMode = 'focused',
  toolEnforcementMode = 'force',
  themePreviewActive = false,
  activeConversationTitle = '主题验证',
  visibleCards = []
}) {
  return {
    modelTier,
    themeToolMode,
    themeContextMode,
    cardContextMode: visibleCards.length > 0 ? 'summary' : 'none',
    toolPromptScopes: ['theme'],
    toolEnforcementMode,
    themePreviewActive,
    themeScopeHint: activeWorld,
    lastUserMessage,
    themeFocus,
    themeSnapshot: {
      cssVariables: {
        '--warm-bg': '#fbf8f2',
        '--warm-card-bg': '#fffdf8',
        '--warm-accent': '#c47f2f',
        '--cool-bg': '#e9efff',
        '--cool-card-bg': '#ffffff',
        '--cool-accent': '#6f8cff',
        '--bubble-user': '#f8f5ff',
        '--bubble-ai': '#ffffff',
        '--radius-pill': '999px',
        '--radius-panel': '24px'
      },
      activePresetId: 'polaris-default',
      activeSavedSkinId: null,
      recipe: null,
      presetCSS: '',
      customCSS: '',
      generatedCSS: ''
    },
    uiSnapshot: {
      activeWorld,
      collectionShelf,
      activeConversationTitle,
      activePersonaName: 'Pharos',
      selectorHints: []
    },
    activeCard: null,
    visibleCards
  };
}

function extractAliasesFromRawCss(cssText) {
  return dedupe(
    Array.from(cssText.matchAll(/([^{}]+)\{/g))
      .flatMap((match) =>
        String(match[1] ?? '')
          .split(',')
          .map((selector) => selector.trim())
          .filter(Boolean)
      )
      .flatMap((selector) => {
        const exactAliases = extractSelectorAliases(selector);
        if (exactAliases.length > 0) return exactAliases;
        return SELECTOR_CATALOG
          .filter((entry) =>
            entry.selectors.some((catalogSelector) => {
              if (!selector.startsWith(catalogSelector)) return false;
              const nextChar = selector.slice(catalogSelector.length, catalogSelector.length + 1);
              return !nextChar || /[:.[#]/.test(nextChar);
            })
          )
          .map((entry) => entry.alias);
      })
  );
}

function expandSurfaceAliasesFromEntry(entry) {
  if (!entry) return [];
  return entry.selectorAliases ?? [];
}

export function classifyConversationTurnFailure({
  turn,
  response,
  evaluation
}) {
  if (evaluation.passed) return [];

  const failureKinds = [];
  const aliases = evaluation.aliases ?? [];
  const issues = response.issues ?? [];
  const expectedAliases = evaluation.expectedAliases ?? [];
  const hasAppScopeLeak =
    !expectedAliases.includes('app-background')
    && aliases.includes('app-background');

  if (issues.includes('rate_limited')) {
    return ['rate_limited'];
  }

  if (turn.requireTool && !hasExecutableAction({ evaluation })) {
    failureKinds.push('missing_tool');
  }
  if (issues.some((issue) => issue === 'http_error' || issue === 'request_timeout' || issue === 'network_error')) {
    failureKinds.push('transport_error');
  }
  if (response.usedNativeToolCalls && response.nativeToolCallCount > 0 && response.actions.length === 0) {
    failureKinds.push('native_parse_drift');
  } else if (
    issues.some((issue) => issue !== 'http_error' && issue !== 'request_timeout' && issue !== 'network_error')
  ) {
    failureKinds.push('schema_drift');
  }
  if (evaluation.resetByPreset || !evaluation.hitExpectedTarget || hasAppScopeLeak) {
    failureKinds.push('scope_drift');
  }
  if (hasExecutableAction({ evaluation }) && !evaluation.continuityOk) {
    failureKinds.push('continuity_drift');
  }

  return dedupe(failureKinds);
}

export function extractValidationAliases(action) {
  switch (action.kind) {
    case 'applyThemeCoordinates': {
      const entries =
        action.targets === 'all'
          ? THEME_SURFACE_REGISTRY
          : action.targets
              .map((code) => findThemeSurfaceEntryByCode(code))
              .filter(Boolean);
      return dedupe(entries.flatMap((entry) => expandSurfaceAliasesFromEntry(entry)));
    }
    case 'applySurfaceTokens': {
      const entry = findThemeSurfaceEntryByRef(action.surface)
        ?? action.targets.map((target) => findThemeSurfaceEntryByRef(target)).find(Boolean)
        ?? null;
      return dedupe(expandSurfaceAliasesFromEntry(entry));
    }
    case 'patchCss':
      return extractSelectorAliases(action.selector);
    case 'patchRawCss':
      return dedupe(['raw-css', ...extractAliasesFromRawCss(action.css)]);
    case 'applyPreset':
      return ['app-background'];
    case 'recolor':
    case 'restyle':
      return action.scope === 'chat'
        ? ['chat-background', 'chat-bubble-shared', 'chat-composer']
        : action.scope === 'collection'
          ? ['collection-background', 'collection-card', 'collection-code-card']
          : ['app-background', 'chat-bubble-shared', 'collection-card'];
    case 'tweak':
      return extractSelectorAliases(action.target);
    default:
      return [];
  }
}

export async function runThemeValidationRequest({
  api,
  key,
  model,
  modelTier,
  prompt,
  context,
  requestTimeoutMs,
  transport
}) {
  const systemPrompt = buildAssistantToolPrompt(context);
  const body = {
    model,
    temperature: 0.35,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]
  };

  if (transport === 'native') {
    const toolRequest = resolveAssistantToolRequestTools(context);
    if (toolRequest.tools.length > 0) {
      body.tools = toolRequest.tools;
      if (toolRequest.toolChoice) {
        body.tool_choice = toolRequest.toolChoice;
      }
    }
  }
  const requestedNativeTools = transport === 'native' && Array.isArray(body.tools) && body.tools.length > 0;
  const rateLimitRetries = Number(process.env.RATE_LIMIT_RETRIES ?? 2);
  const transientRetries = Number(process.env.TRANSIENT_RETRIES ?? 1);
  const rateLimitBackoffMs = Number(process.env.RATE_LIMIT_BACKOFF_MS ?? 5000);
  const startedAt = Date.now();
  let attemptCount = 0;
  let rateLimitRetryCount = 0;
  let transientRetryCount = 0;

  while (true) {
    attemptCount += 1;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      };
      if (api.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER ?? 'https://github.com/example/polaris';
        headers['X-Title'] = process.env.OPENROUTER_X_TITLE ?? 'Polaris Theme Validation';
      }
      const response = await fetch(api, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const rawText = await response.text();
      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        const isRateLimited = response.status === 429 || looksLikeRateLimited(rawText);
        if (isRateLimited && rateLimitRetryCount < rateLimitRetries) {
          rateLimitRetryCount += 1;
          await sleep(resolveRetryAfterMs(response.headers.get('retry-after'), rateLimitBackoffMs));
          continue;
        }
        if (isTransientHttpStatus(response.status) && transientRetryCount < transientRetries) {
          transientRetryCount += 1;
          await sleep(1000);
          continue;
        }
        return {
          ok: false,
          http: response.status,
          latencyMs,
          raw: rawText.slice(0, 500),
          actions: [],
          issues: [isRateLimited ? 'rate_limited' : 'http_error'],
          displayContent: '',
          usedNativeToolCalls: false,
          nativeToolCallCount: 0,
          requestedNativeTools,
          nativeToolParseSucceeded: false,
          attemptCount,
          rateLimitRetryCount,
          transientRetryCount
        };
      }

      const payload = JSON.parse(rawText);
      if (transport === 'native') {
        const reply = extractOpenAiCompatibleReply(payload, model);
        const parsed = extractAssistantToolActions(reply.content, modelTier, context.themeToolMode ?? 'stable');
        return {
          ok: true,
          http: 200,
          latencyMs,
          raw: String(reply.content).slice(0, 700),
          actions: parsed.actions,
          issues: parsed.issues,
          displayContent: parsed.displayContent.slice(0, 300),
          usedNativeToolCalls: reply.usedNativeToolCalls === true,
          nativeToolCallCount: reply.nativeToolCallCount ?? 0,
          requestedNativeTools,
          nativeToolParseSucceeded:
            reply.usedNativeToolCalls === true
            && (reply.nativeToolCallCount ?? 0) > 0
            && parsed.actions.length > 0,
          attemptCount,
          rateLimitRetryCount,
          transientRetryCount
        };
      }

      const content = payload.choices?.[0]?.message?.content || '';
      const parsed = extractAssistantToolActions(content, modelTier, context.themeToolMode ?? 'stable');
      return {
        ok: true,
        http: 200,
        latencyMs,
        raw: String(content).slice(0, 700),
        actions: parsed.actions,
        issues: parsed.issues,
        displayContent: parsed.displayContent.slice(0, 300),
        usedNativeToolCalls: false,
        nativeToolCallCount: 0,
        requestedNativeTools,
        nativeToolParseSucceeded: false,
        attemptCount,
        rateLimitRetryCount,
        transientRetryCount
      };
    } catch (error) {
      const issue = error instanceof Error && error.name === 'AbortError' ? 'request_timeout' : 'network_error';
      if (issue === 'network_error' && transientRetryCount < transientRetries) {
        transientRetryCount += 1;
        await sleep(1000);
        continue;
      }
      return {
        ok: false,
        http: 0,
        latencyMs: Date.now() - startedAt,
        raw: String(error),
        actions: [],
        issues: [issue],
        displayContent: '',
        usedNativeToolCalls: false,
        nativeToolCallCount: 0,
        requestedNativeTools,
        nativeToolParseSucceeded: false,
        attemptCount,
        rateLimitRetryCount,
        transientRetryCount
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function isTransientHttpStatus(status) {
  return status === 408 || status === 502 || status === 503 || status === 504;
}

function looksLikeRateLimited(rawText) {
  return /rate limit|rate limiting|tpm limit/i.test(rawText ?? '');
}

function resolveRetryAfterMs(retryAfterValue, fallbackMs) {
  const seconds = Number(retryAfterValue);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  if (retryAfterValue) {
    const parsedAt = Date.parse(retryAfterValue);
    if (Number.isFinite(parsedAt)) {
      return Math.max(parsedAt - Date.now(), fallbackMs);
    }
  }

  return fallbackMs;
}
