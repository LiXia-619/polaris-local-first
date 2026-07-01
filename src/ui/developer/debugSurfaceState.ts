import {
  isDeveloperModeEnabled,
  POLARIS_DEVELOPER_MODE_EVENT,
  setDeveloperModeEnabled
} from '../../app/developer/developerModeRuntime';

export const DEVELOPER_MODE_SYNC_EVENTS = [POLARIS_DEVELOPER_MODE_EVENT, 'storage'] as const;
export const DEBUG_ROUTE_SYNC_EVENTS = ['storage', 'popstate'] as const;
export const DEVELOPER_DEBUG_ROUTE_SYNC_EVENTS = [
  POLARIS_DEVELOPER_MODE_EVENT,
  ...DEBUG_ROUTE_SYNC_EVENTS
] as const;

const DEBUG_SURFACE_QUERY_PARAMS = [
  'debugRequest',
  'debugAssets',
  'debugQa',
  'debugRuntimePerformance',
  'debugPerf'
] as const;

export function readDebugSurfaceEnabled(params: {
  developerMode?: boolean;
  queryParams: readonly string[];
}) {
  const { developerMode = false, queryParams } = params;
  if (typeof window === 'undefined') return false;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    return (
      (developerMode && isDeveloperModeEnabled())
      || queryParams.some((name) => searchParams.get(name) === '1')
    );
  } catch {
    return developerMode ? isDeveloperModeEnabled() : false;
  }
}

export function subscribeWindowSyncEvents(eventNames: readonly string[], handleSync: () => void) {
  if (typeof window === 'undefined') return () => {};

  eventNames.forEach((eventName) => {
    window.addEventListener(eventName, handleSync);
  });

  return () => {
    eventNames.forEach((eventName) => {
      window.removeEventListener(eventName, handleSync);
    });
  };
}

export function closeDebugSurfaces() {
  setDeveloperModeEnabled(false);

  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    let changed = false;
    DEBUG_SURFACE_QUERY_PARAMS.forEach((name) => {
      if (!url.searchParams.has(name)) return;
      url.searchParams.delete(name);
      changed = true;
    });

    if (changed) {
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      window.dispatchEvent(new Event('popstate'));
    }
  } catch {
  }
}
