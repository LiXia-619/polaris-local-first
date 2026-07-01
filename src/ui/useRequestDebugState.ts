import { useEffect, useState } from 'react';
import type { RequestDebugEntry } from '../engines/request/requestDebugRuntime';
import {
  DEVELOPER_DEBUG_ROUTE_SYNC_EVENTS,
  readDebugSurfaceEnabled,
  subscribeWindowSyncEvents
} from './developer/debugSurfaceState';

type RequestDebugState = {
  enabled: boolean;
  latestEntry: RequestDebugEntry | null;
  entryCount: number;
  clearEntries: () => void;
};

const REQUEST_DEBUG_EVENT = 'polaris:request-debug-updated';
const REQUEST_DEBUG_SYNC_EVENTS = [REQUEST_DEBUG_EVENT, ...DEVELOPER_DEBUG_ROUTE_SYNC_EVENTS] as const;

function readDebugEnabled() {
  return readDebugSurfaceEnabled({ developerMode: true, queryParams: ['debugRequest'] });
}

export function useRequestDebugState(): RequestDebugState {
  const [state, setState] = useState<Omit<RequestDebugState, 'clearEntries'>>({
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

      const { readRequestDebugEntries } = await import('../engines/request/requestDebugRuntime');
      if (disposed) return;
      const entries = readRequestDebugEntries();
      setState({
        enabled: true,
        latestEntry: entries[entries.length - 1] ?? null,
        entryCount: entries.length
      });
    };

    void syncState();
    const handleSync = () => { void syncState(); };
    const unsubscribeSyncEvents = subscribeWindowSyncEvents(REQUEST_DEBUG_SYNC_EVENTS, handleSync);

    return () => {
      disposed = true;
      unsubscribeSyncEvents();
    };
  }, []);

  return {
    ...state,
    clearEntries: async () => {
      const { clearRequestDebugEntries, readRequestDebugEntries } = await import('../engines/request/requestDebugRuntime');
      clearRequestDebugEntries();
      const entries = readRequestDebugEntries();
      setState({
        enabled: readDebugEnabled(),
        latestEntry: entries[entries.length - 1] ?? null,
        entryCount: entries.length
      });
    }
  };
}
