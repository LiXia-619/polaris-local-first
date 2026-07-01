import { createDebugLog } from './debugLog';

export type AppRuntimeLogEntry = {
  id: string;
  at: number;
  kind: 'startup' | 'chat-send-performance';
  title: string;
  detail: string;
};

export const APP_RUNTIME_LOG_EVENT = 'polaris:app-runtime-log-updated';
const APP_RUNTIME_LOG_STORAGE_KEY = 'polaris-app-runtime-log';
const APP_RUNTIME_LOG_LIMIT = 40;

const appRuntimeLog = createDebugLog<AppRuntimeLogEntry>(APP_RUNTIME_LOG_STORAGE_KEY, {
  maxEntries: APP_RUNTIME_LOG_LIMIT,
  broadcastEvent: APP_RUNTIME_LOG_EVENT
});

let queuedEntries: AppRuntimeLogEntry[] = [];
let flushTimer: number | null = null;

function createRuntimeLogId() {
  return `runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function flushQueuedRuntimeLogEntries() {
  flushTimer = null;
  const entries = queuedEntries;
  queuedEntries = [];
  appRuntimeLog.appendMany(entries);
}

function scheduleRuntimeLogFlush() {
  if (typeof window === 'undefined') {
    flushQueuedRuntimeLogEntries();
    return;
  }
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(flushQueuedRuntimeLogEntries, 120);
}

export function recordAppRuntimeLogEntry(entry: Omit<AppRuntimeLogEntry, 'id'>) {
  queuedEntries.push({
    id: createRuntimeLogId(),
    ...entry
  });
  scheduleRuntimeLogFlush();
}

export function readAppRuntimeLogEntries() {
  if (queuedEntries.length > 0) {
    if (flushTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(flushTimer);
    }
    flushQueuedRuntimeLogEntries();
  }
  return appRuntimeLog.read();
}

export function clearAppRuntimeLogEntries() {
  queuedEntries = [];
  if (flushTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(flushTimer);
  }
  flushTimer = null;
  appRuntimeLog.clear();
}
