import type { ElementType, ReactNode } from 'react';
import { COLLECTION_FRONTSTAGE_SURFACES } from '../../frontstage/frontstageSurfaceRegistry';

type CollectionEmptyStateWhisperProps = {
  as?: ElementType;
  ariaLabel?: string;
  className?: string;
  icon?: string;
  title: string;
  hint?: string;
  children?: ReactNode;
};

export function CollectionEmptyStateWhisper({
  as: Component = 'section',
  ariaLabel,
  className,
  icon = '✦',
  title,
  hint,
  children
}: CollectionEmptyStateWhisperProps) {
  return (
    <Component
      className={['empty-state-floating', 'collection-empty-state-whisper', className].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
      data-surface={COLLECTION_FRONTSTAGE_SURFACES.emptyStateWhisper}
    >
      <span className="empty-state-icon" aria-hidden="true">{icon}</span>
      <p className="empty-state-title">{title}</p>
      {hint ? <p className="empty-state-hint">{hint}</p> : null}
      {children}
    </Component>
  );
}
