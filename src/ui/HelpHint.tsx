import { type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

type HelpHintProps = {
  label: string;
  text: string;
  className?: string;
};

type HintPosition = {
  left: number;
  top: number;
  arrowX: number;
  placement: 'above' | 'below';
};

const VIEWPORT_MARGIN = 12;
const TIP_GAP = 9;
const ARROW_MARGIN = 14;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function HelpHint({ label, text, className }: HelpHintProps) {
  const hintId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<HintPosition | null>(null);
  const preferBelow = className?.split(/\s+/).includes('help-hint--below') ?? false;

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const tip = tipRef.current;
    if (!button || !tip) return;

    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxTipWidth = Math.max(160, viewportWidth - VIEWPORT_MARGIN * 2);
    const tipWidth = Math.min(tip.offsetWidth || 260, maxTipWidth);
    const tipHeight = tip.offsetHeight || 72;
    const buttonCenterX = rect.left + rect.width / 2;
    const rawLeft = buttonCenterX - tipWidth / 2;
    const left = clamp(rawLeft, VIEWPORT_MARGIN, viewportWidth - VIEWPORT_MARGIN - tipWidth);
    const aboveTop = rect.top - TIP_GAP - tipHeight;
    const belowTop = rect.bottom + TIP_GAP;
    const canShowAbove = aboveTop >= VIEWPORT_MARGIN;
    const canShowBelow = belowTop + tipHeight <= viewportHeight - VIEWPORT_MARGIN;
    const placement =
      preferBelow
        ? (canShowBelow || !canShowAbove ? 'below' : 'above')
        : (canShowAbove || !canShowBelow ? 'above' : 'below');
    const rawTop = placement === 'above' ? aboveTop : belowTop;
    const top = clamp(rawTop, VIEWPORT_MARGIN, viewportHeight - VIEWPORT_MARGIN - tipHeight);
    const arrowX = clamp(buttonCenterX - left, ARROW_MARGIN, tipWidth - ARROW_MARGIN);

    setPosition({ left, top, arrowX, placement });
  }, [preferBelow]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, text]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || tipRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handleViewportChange = () => updatePosition();

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePosition]);

  const tipStyle = position
    ? ({
        left: `${position.left}px`,
        top: `${position.top}px`,
        '--help-hint-arrow-x': `${position.arrowX}px`
      } as CSSProperties)
    : undefined;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={['help-hint', className].filter(Boolean).join(' ')}
        aria-label={`${label}：${text}`}
        aria-expanded={open}
        aria-controls={open ? hintId : undefined}
        aria-describedby={open ? hintId : undefined}
        data-open={open ? 'true' : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="helpCircle" size={13} />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={tipRef}
              id={hintId}
              className={`help-hint-tip help-hint-tip--open help-hint-tip--${position?.placement ?? (preferBelow ? 'below' : 'above')}`}
              role="tooltip"
              style={tipStyle}
            >
              {text}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
