import { useState } from 'react';
import type { ImageAssetCard } from '../../../types/domain';
import { useVirtualCardWindow } from '../grid/useVirtualCardWindow';
import { ImageAssetCardFace } from './ImageAssetCardFace';

type ImageAssetGridProps = {
  cardsExpanded: boolean;
  cards: ImageAssetCard[];
  onOpenCard: (card: ImageAssetCard) => void;
  onDeleteCard: (cardId: string) => void;
};

type ImageAssetCardItemProps = {
  card: ImageAssetCard;
  cardsExpanded: boolean;
  index: number;
  activeDeleteId: string | null;
  setActiveDeleteId: (id: string | null) => void;
  onOpenCard: (card: ImageAssetCard) => void;
  onDeleteCard: (cardId: string) => void;
};

function ImageAssetCardItem({
  card,
  cardsExpanded,
  index,
  activeDeleteId,
  setActiveDeleteId,
  onOpenCard,
  onDeleteCard
}: ImageAssetCardItemProps) {
  return (
    <ImageAssetCardFace
      card={card}
      cardsExpanded={cardsExpanded}
      index={index}
      activeDelete={activeDeleteId === card.id}
      onActivateDelete={setActiveDeleteId}
      onOpenCard={onOpenCard}
      onDeleteCard={onDeleteCard}
    />
  );
}

export function ImageAssetGrid({
  cardsExpanded,
  cards,
  onOpenCard,
  onDeleteCard
}: ImageAssetGridProps) {
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  const virtualWindow = useVirtualCardWindow({
    itemCount: cards.length,
    minVirtualItems: 48,
    overscanRows: 3,
    estimateRowHeight: (container, columnCount) => {
      const style = window.getComputedStyle(container);
      const columnGap = Number.parseFloat(style.columnGap || style.gap || '0') || 0;
      const rowGap = Number.parseFloat(style.rowGap || style.gap || '0') || 0;
      const availableWidth = Math.max(1, container.clientWidth - columnGap * Math.max(0, columnCount - 1));
      return (availableWidth / Math.max(1, columnCount)) + rowGap + 28;
    }
  });
  const visibleCards = cards.slice(virtualWindow.startIndex, virtualWindow.endIndex);

  return (
    <div className="grid asset-grid" ref={virtualWindow.containerRef}>
      {virtualWindow.topSpacerHeight > 0 ? (
        <div
          className="collection-virtual-spacer"
          style={{ height: virtualWindow.topSpacerHeight }}
          aria-hidden="true"
        />
      ) : null}

      {visibleCards.map((card, index) => (
        <ImageAssetCardItem
          key={card.id}
          card={card}
          cardsExpanded={cardsExpanded}
          index={virtualWindow.startIndex + index}
          activeDeleteId={activeDeleteId}
          setActiveDeleteId={setActiveDeleteId}
          onOpenCard={onOpenCard}
          onDeleteCard={onDeleteCard}
        />
      ))}

      {virtualWindow.bottomSpacerHeight > 0 ? (
        <div
          className="collection-virtual-spacer"
          style={{ height: virtualWindow.bottomSpacerHeight }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
