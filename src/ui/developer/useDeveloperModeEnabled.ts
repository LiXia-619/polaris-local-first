import { useEffect, useState } from 'react';
import { isDeveloperModeEnabled } from '../../app/developer/developerModeRuntime';
import { DEVELOPER_MODE_SYNC_EVENTS, subscribeWindowSyncEvents } from './debugSurfaceState';

export function useDeveloperModeEnabled() {
  const [enabled, setEnabled] = useState(() => isDeveloperModeEnabled());

  useEffect(() => {
    const sync = () => setEnabled(isDeveloperModeEnabled());
    return subscribeWindowSyncEvents(DEVELOPER_MODE_SYNC_EVENTS, sync);
  }, []);

  return enabled;
}
