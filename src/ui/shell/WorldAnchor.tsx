import { useRef } from 'react';
import { COLLECTION_FRONTSTAGE_SURFACES } from '../frontstage/frontstageSurfaceRegistry';
import type { World } from '../../types/domain';
import { WorldMark } from './WorldMark';
import { displayTitleClassName } from '../titleTypography';

const SECRET_LONG_PRESS_MS = 1_200;

type WorldAnchorProps = {
  activeWorld: World;
  title: string;
  titleTone: 'brand' | 'collaborator';
  aggregateCollectionScope: boolean;
  worldLabel: string;
  worldDetail: string | null;
  showWorldLabel: boolean;
  showTitle: boolean;
  spinning: boolean;
  switchLabel: string;
  onToggleWorld: (trigger: HTMLElement | null) => void;
  onSecretLongPress: () => void;
};

export function WorldAnchor({
  activeWorld,
  title,
  titleTone,
  aggregateCollectionScope,
  worldLabel,
  worldDetail,
  showWorldLabel,
  showTitle,
  spinning,
  switchLabel,
  onToggleWorld,
  onSecretLongPress
}: WorldAnchorProps) {
  const pressTimerRef = useRef<number | null>(null);
  const secretTriggeredRef = useRef(false);

  const clearPressTimer = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    secretTriggeredRef.current = false;
    clearPressTimer();
    pressTimerRef.current = window.setTimeout(() => {
      secretTriggeredRef.current = true;
      pressTimerRef.current = null;
      onSecretLongPress();
    }, SECRET_LONG_PRESS_MS);
  };

  const handlePointerEnd = () => {
    clearPressTimer();
  };

  const handleClick = (trigger: HTMLElement | null) => {
    if (secretTriggeredRef.current) {
      secretTriggeredRef.current = false;
      return;
    }
    onToggleWorld(trigger);
  };

  return (
    <button
      className={`brand-trigger world-anchor ${aggregateCollectionScope ? 'world-anchor--aggregate' : ''}`}
      data-surface={COLLECTION_FRONTSTAGE_SURFACES.worldAnchor}
      data-title-tone={titleTone}
      onClick={(event) => handleClick(event.currentTarget)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      aria-label={switchLabel}
    >
      <WorldMark
        world={activeWorld}
        spinning={spinning}
        className="brand-world-mark"
      />
      <div className={`brand ${showTitle ? '' : 'brand-label-only'}`}>
        {showTitle ? <h1 className={displayTitleClassName(title)}>{title}</h1> : null}
        {showWorldLabel ? (
          <p className={showTitle ? undefined : 'brand-label-only-copy'}>
            <span className="pulse-dot" />
            <span className="brand-meta-label">{worldLabel}</span>
            {worldDetail ? (
              <>
                <span className="brand-meta-sep">·</span>
                <span className="brand-meta-detail">{worldDetail}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </button>
  );
}
