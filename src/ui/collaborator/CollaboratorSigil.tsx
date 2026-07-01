import type { CSSProperties } from 'react';
import { PERSONA_COLORS } from '../../config/persona/personaColors';

const SIGIL_PALETTE = [
  '#7B8ABF',
  '#D8B56A',
  '#A87BC7',
  '#6FA8A1',
  '#D98989',
  '#8E9BD4',
  '#C29D79',
  '#88A8D8',
  '#5F78A8',
  '#B68FBC',
  '#6D9F8E',
  '#C77F73',
  '#5970B2',
  '#A6A56C',
  '#6E8BA6',
  '#B1848F'
];

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function resolveSigilColor(seed: string) {
  return PERSONA_COLORS[seed] ?? SIGIL_PALETTE[hashSeed(seed) % SIGIL_PALETTE.length];
}

function renderSigil(variant: number, color: string) {
  const stroke = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.35,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  switch (variant) {
    case 0:
      return (
        <>
          <path d="M12 5.2L13.4 9.3L17.5 10.7L13.4 12.1L12 16.2L10.6 12.1L6.5 10.7L10.6 9.3L12 5.2Z" fill={color} fillOpacity="0.88" />
          <circle cx="18.2" cy="7.1" r="1.1" fill={color} fillOpacity="0.7" />
        </>
      );
    case 1:
      return (
        <>
          <circle cx="12" cy="12" r="5.4" {...stroke} />
          <path d="M12 4.7C14.3 4.7 16.4 6 17.4 8" {...stroke} opacity="0.42" />
          <circle cx="17.5" cy="8.4" r="1.15" fill={color} />
        </>
      );
    case 2:
      return (
        <>
          <circle cx="8.2" cy="9.2" r="1.7" fill={color} fillOpacity="0.92" />
          <circle cx="12" cy="7.3" r="1.35" fill={color} fillOpacity="0.82" />
          <circle cx="15.8" cy="9.2" r="1.7" fill={color} fillOpacity="0.92" />
          <circle cx="9.4" cy="14.8" r="1.55" fill={color} fillOpacity="0.88" />
          <circle cx="14.6" cy="14.8" r="1.55" fill={color} fillOpacity="0.88" />
          <path d="M8.2 9.2L12 7.3L15.8 9.2L14.6 14.8L9.4 14.8L8.2 9.2Z" {...stroke} opacity="0.6" />
        </>
      );
    case 3:
      return (
        <>
          <path d="M12 4.9L16.9 8.4L16.1 14.5L12 18L7.9 14.5L7.1 8.4L12 4.9Z" {...stroke} />
          <path d="M12 8.2L14.5 10L14.1 13.1L12 14.8L9.9 13.1L9.5 10L12 8.2Z" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.05" strokeLinejoin="round" />
        </>
      );
    case 4:
      return (
        <>
          <path d="M9 16.1C9.8 13.2 11.3 11.5 13.5 10.2C15.4 9.1 16.5 7.9 16.5 6.4" {...stroke} />
          <path d="M7.7 18.1C9.5 18.1 11.2 17.4 12.7 16.1" {...stroke} opacity="0.72" />
          <circle cx="16.5" cy="6.4" r="1.3" fill={color} />
          <circle cx="8.4" cy="18" r="1.15" fill={color} fillOpacity="0.72" />
        </>
      );
    case 5:
      return (
        <>
          <path d="M12 4.7V18.6" {...stroke} />
          <path d="M7.8 10.2H16.2" {...stroke} opacity="0.72" />
          <circle cx="12" cy="4.7" r="1.2" fill={color} />
          <circle cx="12" cy="18.6" r="1.2" fill={color} />
          <circle cx="7.8" cy="10.2" r="1" fill={color} fillOpacity="0.7" />
          <circle cx="16.2" cy="10.2" r="1" fill={color} fillOpacity="0.7" />
        </>
      );
    case 6:
      return (
        <>
          <path d="M8.1 15.3C8.1 11.7 10.4 8.8 13.7 7.8" {...stroke} />
          <path d="M15.2 7.5L17 5.7" {...stroke} opacity="0.72" />
          <path d="M14.2 8.5L16 10.3" {...stroke} opacity="0.72" />
          <circle cx="8.1" cy="15.3" r="1.15" fill={color} />
          <circle cx="13.7" cy="7.8" r="1.15" fill={color} />
        </>
      );
    case 7:
      return (
        <>
          <path d="M7.3 12C8.5 8.7 10.8 7.1 14.1 7.1C15.8 7.1 17.1 7.5 18.3 8.3" {...stroke} />
          <path d="M5.7 14.7C7.2 16.8 9.3 17.9 12 17.9C13.6 17.9 15 17.5 16.2 16.6" {...stroke} opacity="0.72" />
          <circle cx="18.3" cy="8.3" r="1.2" fill={color} />
          <circle cx="5.7" cy="14.7" r="1.2" fill={color} fillOpacity="0.82" />
        </>
      );
    case 8:
      return (
        <>
          <path d="M8.2 16.5L12 5.8L15.8 16.5" {...stroke} />
          <path d="M9.6 12.7H14.4" {...stroke} opacity="0.72" />
          <circle cx="12" cy="5.8" r="1.2" fill={color} />
        </>
      );
    case 9:
      return (
        <>
          <path d="M12 6.3C15.1 6.3 17.7 8.9 17.7 12C17.7 15.1 15.1 17.7 12 17.7C8.9 17.7 6.3 15.1 6.3 12C6.3 8.9 8.9 6.3 12 6.3Z" {...stroke} />
          <path d="M12 4.5V7" {...stroke} opacity="0.72" />
          <path d="M19.5 12H17" {...stroke} opacity="0.72" />
          <path d="M12 19.5V17" {...stroke} opacity="0.72" />
          <path d="M4.5 12H7" {...stroke} opacity="0.72" />
          <circle cx="12" cy="12" r="1.3" fill={color} />
        </>
      );
    case 10:
      return (
        <>
          <path d="M8.4 16.2L10.2 7.9L12.7 12.1L15.1 7.2L16.9 16.2" {...stroke} />
          <circle cx="10.2" cy="7.9" r="1.05" fill={color} />
          <circle cx="15.1" cy="7.2" r="1.05" fill={color} />
          <circle cx="16.9" cy="16.2" r="1.05" fill={color} fillOpacity="0.72" />
        </>
      );
    case 11:
      return (
        <>
          <path
            d="M12 5.15C14.26 5.15 16.3 6.4 17.4 8.38"
            fill="none"
            stroke={color}
            strokeWidth="1.28"
            strokeLinecap="round"
            opacity="0.72"
          />
          <path
            d="M6.68 10.1C7.42 7.25 9.54 5.15 12 5.15"
            fill="none"
            stroke={color}
            strokeWidth="1.28"
            strokeLinecap="round"
            opacity="0.46"
          />
          <path
            d="M12 7.9L12.76 10.38L15.24 11.15L12.76 11.92L12 14.4L11.24 11.92L8.76 11.15L11.24 10.38L12 7.9Z"
            fill={color}
            fillOpacity="0.84"
          />
          <path
            d="M12 14.9V18.35"
            fill="none"
            stroke={color}
            strokeWidth="1.05"
            strokeLinecap="round"
            opacity="0.5"
          />
          <circle cx="17.4" cy="8.38" r="1" fill={color} fillOpacity="0.68" />
        </>
      );
    case 12:
      return (
        <>
          <circle
            cx="12"
            cy="12"
            r="6.1"
            fill="none"
            stroke={color}
            strokeWidth="1.58"
            strokeLinecap="round"
            strokeDasharray="31.4 6.9"
            strokeDashoffset="2.2"
            transform="rotate(-42 12 12)"
          />
          <path d="M12 9.45L12.74 11.26L14.55 12L12.74 12.74L12 14.55L11.26 12.74L9.45 12L11.26 11.26L12 9.45Z" fill={color} fillOpacity="0.9" />
        </>
      );
    default:
      return (
        <>
          <path d="M8 16L10.8 9.4L13.5 6.1L16 12.8" {...stroke} />
          <path d="M7 17.9H17" {...stroke} opacity="0.46" />
          <path d="M10.2 11.3H14.3" {...stroke} opacity="0.68" />
          <circle cx="13.5" cy="6.1" r="1.2" fill={color} />
          <circle cx="16" cy="12.8" r="1" fill={color} fillOpacity="0.72" />
        </>
      );
  }
}

type CollaboratorSigilProps = {
  seed: string | null;
  size?: number;
  className?: string;
};

export function CollaboratorSigil({ seed, size = 18, className = '' }: CollaboratorSigilProps) {
  const resolvedSeed = seed ?? 'orphaned';
  const color = resolveSigilColor(resolvedSeed);
  const variant = hashSeed(resolvedSeed) % 13;
  const style = {
    '--collaborator-sigil-color': color,
    width: `${size}px`,
    height: `${size}px`
  } as CSSProperties;

  return (
    <span className={`collaborator-sigil ${className}`.trim()} style={style} aria-hidden="true">
      <svg width={Math.max(12, size - 2)} height={Math.max(12, size - 2)} viewBox="0 0 24 24">
        {renderSigil(variant, color)}
      </svg>
    </span>
  );
}
