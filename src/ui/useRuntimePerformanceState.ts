import { useEffect, useState } from 'react';
import type { RuntimePerformanceEntry } from '../app/developer/runtime-performance/runtimePerformanceEvent';
import {
  DEBUG_ROUTE_SYNC_EVENTS,
  readDebugSurfaceEnabled,
  subscribeWindowSyncEvents
} from './developer/debugSurfaceState';

type RuntimePerformanceState = {
  enabled: boolean;
  latestEntry: RuntimePerformanceEntry | null;
  entryCount: number;
  clearEntries: () => void;
};

const RUNTIME_PERFORMANCE_DEBUG_EVENT = 'polaris:runtime-performance-updated';
const RUNTIME_PERFORMANCE_SYNC_EVENTS = [RUNTIME_PERFORMANCE_DEBUG_EVENT, ...DEBUG_ROUTE_SYNC_EVENTS] as const;

function readDebugEnabled() {
  return readDebugSurfaceEnabled({ queryParams: ['debugRuntimePerformance', 'debugPerf'] });
}

export function useRuntimePerformanceState(): RuntimePerformanceState {
  const [state, setState] = useState<Omit<RuntimePerformanceState, 'clearEntries'>>({
    enabled: readDebugEnabled(),
    latestEntry: null,
    entryCount: 0
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let disposed = false;

    const syncState = async () => {
      const enabled = readDebugEnabled();
      if (!enabled) {
        if (!disposed) {
          setState({
            enabled: false,
            latestEntry: null,
            entryCount: 0
          });
        }
        return;
      }

      const { readRuntimePerformanceEntries } = await import('../app/developer/runtime-performance/runtimePerformanceLog');
      if (disposed) return;
      const entries = readRuntimePerformanceEntries();
      setState({
        enabled: true,
        latestEntry: entries[entries.length - 1] ?? null,
        entryCount: entries.length
      });
    };

    void syncState();
    const handleSync = () => { void syncState(); };
    const unsubscribeSyncEvents = subscribeWindowSyncEvents(RUNTIME_PERFORMANCE_SYNC_EVENTS, handleSync);

    return () => {
      disposed = true;
      unsubscribeSyncEvents();
    };
  }, []);

  return {
    ...state,
    clearEntries: async () => {
      const { clearRuntimePerformanceEntries, readRuntimePerformanceEntries } = await import('../app/developer/runtime-performance/runtimePerformanceLog');
      clearRuntimePerformanceEntries();
      const entries = readRuntimePerformanceEntries();
      setState({
        enabled: readDebugEnabled(),
        latestEntry: entries[entries.length - 1] ?? null,
        entryCount: entries.length
      });
    }
  };
}
