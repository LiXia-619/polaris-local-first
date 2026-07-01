import { useEffect, useRef, useState } from 'react';
import type { World } from '../../types/domain';
import { selectionHaptic } from '../haptics';
import { WorldMark } from './WorldMark';

type WorldSwitchVeilProps = {
  activeWorld: World;
  canReviveTheme: boolean;
  onToggleWorld: () => void;
  onReviveLastSkin: () => void;
  onRestoreDefaultTheme: () => void;
};

const AUTO_COLLAPSE_DELAY_MS = 1800;
const LONG_PRESS_REVIVE_MS = 620;

export function WorldSwitchVeil({
  activeWorld,
  canReviveTheme,
  onToggleWorld,
  onReviveLastSkin,
  onRestoreDefaultTheme
}: WorldSwitchVeilProps) {
  const [revealed, setRevealed] = useState(false);
  const [reviveOpen, setReviveOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerToggleTriggeredRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const targetWorld: World = activeWorld === 'chat' ? 'collection' : 'chat';

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const scheduleHide = (delayMs = AUTO_COLLAPSE_DELAY_MS) => {
    if (reviveOpen) return;
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setRevealed(false);
      hideTimerRef.current = null;
    }, delayMs);
  };

  const reveal = () => {
    setRevealed(true);
    scheduleHide();
  };

  useEffect(() => () => {
    clearHideTimer();
    clearLongPressTimer();
  }, []);

  useEffect(() => {
    if (!reviveOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (hostRef.current?.contains(event.target as Node)) return;
      setReviveOpen(false);
      scheduleHide(180);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [reviveOpen]);

  const openRevivePopover = () => {
    clearHideTimer();
    clearLongPressTimer();
    longPressTriggeredRef.current = true;
    setReviveOpen(true);
    setRevealed(true);
    void selectionHaptic();
  };

  return (
    <div ref={hostRef} className={`world-switch-veil-host ${activeWorld} ${reviveOpen ? 'revive-open' : ''}`}>
      <button
        type="button"
        className={`world-switch-veil ${activeWorld} ${revealed ? 'revealed' : 'collapsed'} ${reviveOpen ? 'revive-open' : ''}`}
        aria-label={`切换到${activeWorld === 'chat' ? '房间' : '对话'}`}
        onContextMenu={(event) => event.preventDefault()}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') {
            reveal();
          }
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          clearLongPressTimer();
          longPressTriggeredRef.current = false;
          pointerToggleTriggeredRef.current = false;
          longPressTimerRef.current = window.setTimeout(() => {
            openRevivePopover();
          }, LONG_PRESS_REVIVE_MS);
        }}
        onPointerUp={() => {
          clearLongPressTimer();
          if (longPressTriggeredRef.current || reviveOpen) return;
          pointerToggleTriggeredRef.current = true;
          clearHideTimer();
          setRevealed(false);
          onToggleWorld();
        }}
        onPointerCancel={() => clearLongPressTimer()}
        onPointerLeave={() => {
          clearLongPressTimer();
          if (!reviveOpen) {
            scheduleHide(520);
          }
        }}
        onFocus={() => reveal()}
        onBlur={() => {
          if (!reviveOpen) {
            scheduleHide(220);
          }
        }}
        onClick={(event) => {
          if (pointerToggleTriggeredRef.current) {
            event.preventDefault();
            pointerToggleTriggeredRef.current = false;
            return;
          }
          if (longPressTriggeredRef.current) {
            event.preventDefault();
            longPressTriggeredRef.current = false;
            return;
          }
          if (reviveOpen) {
            event.preventDefault();
            return;
          }
          clearHideTimer();
          setRevealed(false);
          onToggleWorld();
        }}
      >
        <span className="world-switch-veil-halo" aria-hidden="true" />
        <span className="world-switch-veil-core" aria-hidden="true" />
        <span className="world-switch-veil-sheen" aria-hidden="true" />
        <span className="world-switch-veil-icon" aria-hidden="true">
          <WorldMark world={targetWorld} className="world-switch-veil-mark" />
        </span>
      </button>

      {reviveOpen ? (
        <div className="world-switch-revive-popover" role="dialog" aria-label="主题复活">
          <strong>复活 Polaris？</strong>
          <p>长按边缘就能把孩子拉回来。要么回上一张稳定皮，要么直接恢复默认底座。</p>
          <div className="world-switch-revive-actions">
            <button
              type="button"
              disabled={!canReviveTheme}
              onClick={() => {
                onReviveLastSkin();
                setReviveOpen(false);
                setRevealed(false);
              }}
            >
              回上一张
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onRestoreDefaultTheme();
                setReviveOpen(false);
                setRevealed(false);
              }}
            >
              恢复默认
            </button>
          </div>
          <button
            type="button"
            className="world-switch-revive-cancel"
            onClick={() => {
              setReviveOpen(false);
              scheduleHide(220);
            }}
          >
            先算了
          </button>
        </div>
      ) : null}
    </div>
  );
}
