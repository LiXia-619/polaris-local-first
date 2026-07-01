import { useId } from 'react';
import type { World } from '../../types/domain';

type WorldMarkProps = {
  world: World;
  spinning?: boolean;
  className?: string;
};

export function WorldMark({
  world,
  spinning = false,
  className = ''
}: WorldMarkProps) {
  const markId = useId().replace(/:/g, '');
  const bodyGradientId = `${markId}-body`;
  const glowGradientId = `${markId}-glow`;
  const glintGradientId = `${markId}-glint`;
  const classes = ['world-mark', spinning ? 'spinning' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} aria-hidden="true">
      <span className={`world-mark-rotor world-mark-rotor-${world}`}>
        <svg className="world-mark-svg" viewBox="0 0 24 24">
          <defs>
            <radialGradient id={glowGradientId} cx="50%" cy="46%" r="56%">
              <stop offset="0" stopColor="var(--app-star-glow-core, #fff4df)" stopOpacity="var(--app-star-glow-opacity, 0.5)" />
              <stop offset="0.44" stopColor="var(--app-star-color, #9fdcff)" stopOpacity="var(--app-star-aura-opacity, 0.28)" />
              <stop offset="0.76" stopColor="var(--app-star-color-mid, #d8b9ff)" stopOpacity="var(--app-star-aura-edge-opacity, 0.18)" />
              <stop offset="1" stopColor="var(--app-star-color-warm, #f6a7cf)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={bodyGradientId} x1="6.1" y1="5.2" x2="18.2" y2="18.6" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--app-star-color, #8edfff)" />
              <stop offset="0.32" stopColor="var(--app-star-color-soft, #aeb8ff)" />
              <stop offset="0.55" stopColor="var(--app-star-color-mid, #dec2ff)" />
              <stop offset="0.74" stopColor="var(--app-star-color-warm, #f5c3d5)" />
              <stop offset="1" stopColor="var(--app-star-color-end, #f5d79a)" />
            </linearGradient>
            <linearGradient id={glintGradientId} x1="8.6" y1="6.4" x2="15.7" y2="17.6" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.42" stopColor="var(--app-star-glow-core, #eaf7ff)" stopOpacity="var(--app-star-glint-opacity, 0.38)" />
              <stop offset="0.66" stopColor="var(--app-star-color-warm, #ffe7f1)" stopOpacity="var(--app-star-glint-edge-opacity, 0.18)" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.9L14.25 9.75L21.1 12L14.25 14.25L12 21.1L9.75 14.25L2.9 12L9.75 9.75L12 2.9Z"
            fill={`url(#${glowGradientId})`}
            opacity="0.58"
          />
          <path
            d="M12 4L13.8 10.2L20 12L13.8 13.8L12 20L10.2 13.8L4 12L10.2 10.2L12 4Z"
            fill={`url(#${bodyGradientId})`}
            fillOpacity="var(--app-star-opacity, 0.98)"
          />
          <path
            d="M12 5.8L12.86 10.98L18.2 12L12.88 12.88L12 18.2L11.1 12.88L5.8 12L11 10.98L12 5.8Z"
            fill={`url(#${glintGradientId})`}
            opacity="0.4"
          />
        </svg>
      </span>
    </span>
  );
}
