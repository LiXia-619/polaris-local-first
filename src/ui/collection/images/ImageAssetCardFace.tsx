import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { ImageAssetCard } from '../../../types/domain';
import { useAssetMeta, useAssetObjectUrl } from '../../useAssetObjectUrl';
import { Icon } from '../../Icon';
import { runImpactAction, runSelectionAction } from '../../haptics';
import { useTapIntentGuard } from '../useTapIntentGuard';
import { useI18n } from '../../../i18n';

function formatPhotoDate(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}.${month}.${day}`;
}

type ImageAssetCardFaceProps = Omit<ComponentPropsWithoutRef<'article'>, 'className' | 'children'> & {
  card: ImageAssetCard;
  cardsExpanded?: boolean;
  index?: number;
  activeDelete?: boolean;
  onOpenCard?: (card: ImageAssetCard) => void;
  onDeleteCard?: (cardId: string) => void;
  onActivateDelete?: (cardId: string) => void;
  className?: string;
  children?: ReactNode;
};

export function ImageAssetCardFace({
  card,
  cardsExpanded = false,
  index = 0,
  activeDelete = false,
  onOpenCard,
  onDeleteCard,
  onActivateDelete,
  className,
  children,
  ...articleProps
}: ImageAssetCardFaceProps) {
  const { t } = useI18n();
  const imageUrl = useAssetObjectUrl(card.assetId, true);
  const assetMeta = useAssetMeta(card.assetId);
  const imageLabel = card.title || assetMeta?.name || t('collection.image.fallbackImage');
  const tapIntent = useTapIntentGuard();
  const interactive = Boolean(onOpenCard);

  return (
    <article
      {...articleProps}
      key={card.id}
      className={[
        'card asset-card actionable-card',
        cardsExpanded ? 'editing' : 'viewing',
        index % 3 === 0 ? 'tilt-left' : index % 3 === 1 ? 'tilt-right' : 'tilt-flat',
        className ?? ''
      ].filter(Boolean).join(' ')}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? t('collection.image.openAria', { title: imageLabel }) : imageLabel}
      onPointerDown={interactive ? tapIntent.handlePointerDown : undefined}
      onPointerMove={interactive ? tapIntent.handlePointerMove : undefined}
      onPointerUp={interactive ? tapIntent.handlePointerEnd : undefined}
      onPointerCancel={interactive ? tapIntent.handlePointerEnd : undefined}
      onClick={interactive ? (event) => {
        if (!tapIntent.shouldAllowTap()) return;
        runSelectionAction(() => onOpenCard?.(card), { element: event.currentTarget });
      } : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        runSelectionAction(() => onOpenCard?.(card), { settle: 'none' });
      } : undefined}
    >
      {onDeleteCard ? (
        <button
          type="button"
          className={`${cardsExpanded ? 'card-delete-badge' : ''} asset-card-delete ${activeDelete ? 'active' : ''}`}
          aria-label={t('collection.image.deleteAria', { title: imageLabel })}
          onClick={(event) => {
            event.stopPropagation();
            onActivateDelete?.(card.id);
            runImpactAction(() => onDeleteCard(card.id), { element: event.currentTarget });
          }}
        >
          <Icon name="x" size={10} />
        </button>
      ) : null}
      <div className="asset-card-image-wrap">
        <a
          href={imageUrl ?? '#'}
          download={assetMeta?.name}
          className="asset-card-photo-link"
          aria-label={t('collection.image.viewAria', { title: imageLabel })}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!interactive || !tapIntent.shouldAllowTap()) return;
            runSelectionAction(() => onOpenCard?.(card), { element: event.currentTarget });
          }}
        >
          {imageUrl ? <img src={imageUrl} alt={imageLabel} className="asset-card-image" /> : null}
        </a>
      </div>
      <span className="asset-card-date">{formatPhotoDate(card.createdAt || card.updatedAt)}</span>
      {children}
    </article>
  );
}
