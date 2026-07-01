import { createDebugLog } from '../../../infrastructure/debugLog';
import type { RuntimePerformanceEntry } from './runtimePerformanceEvent';

export const RUNTIME_PERFORMANCE_DEBUG_EVENT = 'polaris:runtime-performance-updated';
const RUNTIME_PERFORMANCE_STORAGE_KEY = 'polaris-runtime-performance-log';
const RUNTIME_PERFORMANCE_LIMIT = 48;

const runtimePerformanceLog = createDebugLog<RuntimePerformanceEntry>(RUNTIME_PERFORMANCE_STORAGE_KEY, {
  maxEntries: RUNTIME_PERFORMANCE_LIMIT,
  broadcastEvent: RUNTIME_PERFORMANCE_DEBUG_EVENT
});

export function readRuntimePerformanceEntries(): RuntimePerformanceEntry[] {
  return runtimePerformanceLog.read();
}

export function clearRuntimePerformanceEntries() {
  runtimePerformanceLog.clear();
}

export function appendRuntimePerformanceEntry(entry: RuntimePerformanceEntry) {
  runtimePerformanceLog.append(entry);
}
