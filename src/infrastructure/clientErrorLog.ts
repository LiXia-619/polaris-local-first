export type ClientErrorLogEntry = {
  id: string;
  at: string;
  source: 'boundary' | 'window-error' | 'unhandled-rejection' | 'persistence';
  message: string;
  stack?: string;
  componentStack?: string;
  context?: string;
  url?: string;
};

const CLIENT_ERROR_LOG_KEY = 'polaris-client-error-log';
const MAX_CLIENT_ERROR_LOG_ENTRIES = 5;

function compactClientErrorEntries(entries: unknown[]): ClientErrorLogEntry[] {
  return entries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .filter((entry) => typeof entry.id === 'string')
    .slice(0, MAX_CLIENT_ERROR_LOG_ENTRIES)
    .map((entry) => ({
      id: String(entry.id),
      at: typeof entry.at === 'string' ? entry.at : '',
      source: entry.source === 'boundary'
        || entry.source === 'window-error'
        || entry.source === 'unhandled-rejection'
        || entry.source === 'persistence'
          ? entry.source
          : 'persistence',
      message: typeof entry.message === 'string' ? entry.message.slice(0, 500) : 'Unknown error',
      stack: typeof entry.stack === 'string' ? entry.stack.slice(0, 1200) : undefined,
      componentStack: typeof entry.componentStack === 'string' ? entry.componentStack.slice(0, 1200) : undefined,
      context: typeof entry.context === 'string' ? entry.context.slice(0, 200) : undefined,
      url: typeof entry.url === 'string' ? entry.url : undefined
    }));
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function errorStack(error: unknown) {
  return error instanceof Error && error.stack ? error.stack : undefined;
}

function makeErrorId() {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function currentUrl() {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.location?.href;
  } catch {
    return undefined;
  }
}

function readStoredEntries(): ClientErrorLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CLIENT_ERROR_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? compactClientErrorEntries(parsed) : [];
  } catch {
    return [];
  }
}

function writeStoredEntries(entries: ClientErrorLogEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLIENT_ERROR_LOG_KEY, JSON.stringify(compactClientErrorEntries(entries)));
  } catch {
    try {
      window.localStorage.setItem(CLIENT_ERROR_LOG_KEY, JSON.stringify(compactClientErrorEntries(entries).slice(0, 1)));
    } catch {
      // Local diagnostics must never make the app crash harder.
    }
  }
}

export function recordClientError(
  error: unknown,
  source: ClientErrorLogEntry['source'],
  details: Pick<ClientErrorLogEntry, 'componentStack' | 'context'> = {}
) {
  const entry: ClientErrorLogEntry = {
    id: makeErrorId(),
    at: new Date().toISOString(),
    source,
    message: errorMessage(error),
    stack: errorStack(error),
    componentStack: details.componentStack,
    context: details.context,
    url: currentUrl()
  };
  writeStoredEntries([entry, ...readStoredEntries()]);
  return entry;
}

export function readClientErrorLog() {
  return readStoredEntries();
}

export function clearClientErrorLog() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CLIENT_ERROR_LOG_KEY);
  } catch {
    // Diagnostics cleanup must not make storage failures louder.
  }
}

export function installGlobalClientErrorLogging() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (event) => {
    recordClientError(event.error ?? event.message, 'window-error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    recordClientError(event.reason, 'unhandled-rejection');
  });
}
