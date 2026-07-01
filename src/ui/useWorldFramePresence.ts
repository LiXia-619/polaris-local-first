import { useEffect, useRef, useState } from 'react';
import { recordWorldSwitchStage, startWorldSwitch } from '../app/developer/runtime-performance/runtimePerformanceDebug';
import type { World } from '../types/domain';

const WORLD_HIDE_DELAY_MS = 80;
const WORLD_UNMOUNT_DELAY_MS = 120;

type WorldFramePresence = {
  renderChat: boolean;
  renderCollection: boolean;
  renderGroup: boolean;
  hideChat: boolean;
  hideCollection: boolean;
  hideGroup: boolean;
};

export function resolveWorldPresenceForRender(
  current: WorldFramePresence,
  previousWorld: World,
  activeWorld: World
): WorldFramePresence {
  return previousWorld === activeWorld
    ? current
    : createSwitchWorldPresence(current, activeWorld);
}

export function createSettledWorldPresence(activeWorld: World): WorldFramePresence {
  return {
    renderChat: activeWorld === 'chat',
    renderCollection: activeWorld === 'collection',
    renderGroup: activeWorld === 'group',
    hideChat: false,
    hideCollection: false,
    hideGroup: false
  };
}

export function createSwitchWorldPresence(current: WorldFramePresence, activeWorld: World): WorldFramePresence {
  return {
    renderChat: current.renderChat || activeWorld === 'chat',
    renderCollection: current.renderCollection || activeWorld === 'collection',
    renderGroup: current.renderGroup || activeWorld === 'group',
    hideChat: activeWorld === 'chat' ? false : current.hideChat,
    hideCollection: activeWorld === 'collection' ? false : current.hideCollection,
    hideGroup: activeWorld === 'group' ? false : current.hideGroup
  };
}

export function createHiddenWorldPresence(current: WorldFramePresence, activeWorld: World): WorldFramePresence {
  return {
    ...current,
    hideChat: activeWorld !== 'chat' && current.renderChat,
    hideCollection: activeWorld !== 'collection' && current.renderCollection,
    hideGroup: activeWorld !== 'group' && current.renderGroup
  };
}

export function useWorldFramePresence(activeWorld: World): WorldFramePresence {
  const [presence, setPresence] = useState<WorldFramePresence>(() => createSettledWorldPresence(activeWorld));
  const presenceRef = useRef(presence);
  const previousWorldRef = useRef(activeWorld);
  const switchIdRef = useRef<string | null>(null);
  const renderPresence = resolveWorldPresenceForRender(presence, previousWorldRef.current, activeWorld);

  useEffect(() => {
    presenceRef.current = presence;
  }, [presence]);

  useEffect(() => {
    const current = presenceRef.current;
    const nextPresence = resolveWorldPresenceForRender(current, previousWorldRef.current, activeWorld);
    setPresence(nextPresence);
    presenceRef.current = nextPresence;

    if (previousWorldRef.current !== activeWorld) {
      switchIdRef.current = startWorldSwitch({
        fromWorld: previousWorldRef.current,
        toWorld: activeWorld,
        ...nextPresence
      });
      previousWorldRef.current = activeWorld;
    }

    const hideTimeoutId = window.setTimeout(() => {
      setPresence((currentState) => {
        const next = createHiddenWorldPresence(currentState, activeWorld);
        presenceRef.current = next;
        recordWorldSwitchStage({
          switchId: switchIdRef.current,
          stage: 'hide',
          ...next
        });
        return next;
      });
    }, WORLD_HIDE_DELAY_MS);

    const unmountTimeoutId = window.setTimeout(() => {
      setPresence(() => {
        const next = createSettledWorldPresence(activeWorld);
        presenceRef.current = next;
        recordWorldSwitchStage({
          switchId: switchIdRef.current,
          stage: 'unmount',
          ...next
        });
        return next;
      });
    }, WORLD_UNMOUNT_DELAY_MS);

    return () => {
      window.clearTimeout(hideTimeoutId);
      window.clearTimeout(unmountTimeoutId);
    };
  }, [activeWorld]);

  return renderPresence;
}
