import { memo, useMemo, type ReactNode } from 'react';
import { Icon } from '../../Icon';
import { COLLECTION_FRONTSTAGE_SURFACES } from '../../frontstage/frontstageSurfaceRegistry';
import type { CodeCard, ProjectFile, RoomProject } from '../../../types/domain';
import { DEFAULT_CODE_CARD_FACE_ROOT_SCOPE, buildScopedCodeCardFaceCss } from '../../../engines/collectionCardFace';
import { useI18n } from '../../../i18n';
import { runImpactAction, runSelectionAction } from '../../haptics';
import { cleanDisplayText } from '../../text/displayText';
import { resolveRoomScopedTags } from '../../../app/collection/codeCollectionFilterModel';
import { useTapIntentGuard } from '../useTapIntentGuard';
import { resolveRoomProjectFiles } from '../../../engines/roomProjects';
import { CodeCardFace } from './CodeCardFace';
import { RoomProjectCard } from './RoomProjectCard';
import { ScopedCardFaceStyle } from './ScopedCardFaceStyle';
import { useVirtualCardWindow } from '../grid/useVirtualCardWindow';

function displayTags(card: CodeCard, roomTags: string[], uncategorizedLabel: string) {
  const scopedTags = resolveRoomScopedTags(card, roomTags);
  if (roomTags.length > 0) {
    return scopedTags.length > 0 ? scopedTags.slice(0, 4) : [uncategorizedLabel];
  }
  return [card.language, ...card.tags.filter((tag) => tag !== card.language)].slice(0, 4);
}

type CodeCardGridProps = {
  cardsExpanded: boolean;
  viewMode: 'cards' | 'files';
  leadingCard?: ReactNode;
  roomTags: string[];
  cards: CodeCard[];
  projectFiles: ProjectFile[];
  roomProjects: RoomProject[];
  activeCardId: string | null;
  spotlightCardId: string | null;
  resolveOriginCopy: (card: CodeCard) => string | null;
  onOpenProject: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onOpenCard: (cardId: string) => void;
  onRunCard: (card: CodeCard) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleCardPinned: (cardId: string) => void;
  onToggleProjectPinned: (projectId: string) => void;
};

type CodeCardItemProps = {
  card: CodeCard;
  cardsExpanded: boolean;
  roomTags: string[];
  activeCardId: string | null;
  spotlightCardId: string | null;
  resolveOriginCopy: (card: CodeCard) => string | null;
  onOpenCard: (cardId: string) => void;
  onRunCard: (card: CodeCard) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleCardPinned: (cardId: string) => void;
  uncategorizedLabel: string;
};

type CodeGridItem =
  | { kind: 'project'; entry: { project: RoomProject; files: ReturnType<typeof resolveRoomProjectFiles> } }
  | { kind: 'card'; card: CodeCard };

const mutedRoomTagClassName = (tag: string, uncategorizedLabel: string) => tag === uncategorizedLabel ? 'tag-muted' : undefined;
const CODE_CARD_GRID_MIN_VIRTUAL_ITEMS = 48;
const CODE_CARD_GRID_OVERSCAN_ROWS = 5;

function estimateCodeCardRowHeight(container: HTMLElement, columnCount: number) {
  const style = window.getComputedStyle(container);
  const gap = Number.parseFloat(style.rowGap || style.gap || '12') || 12;
  const inlineGap = Number.parseFloat(style.columnGap || style.gap || `${gap}`) || gap;
  const cardWidth = (container.clientWidth - inlineGap * Math.max(0, columnCount - 1)) / Math.max(1, columnCount);
  return Math.max(176, Math.min(340, cardWidth * 1.12)) + gap;
}

const CodeCardItem = memo(function CodeCardItem({
  card,
  cardsExpanded,
  roomTags,
  activeCardId,
  spotlightCardId,
  resolveOriginCopy,
  onOpenCard,
  onRunCard,
  onDeleteCard,
  onToggleCardPinned,
  uncategorizedLabel
}: CodeCardItemProps) {
  const { t } = useI18n();
  const tapIntent = useTapIntentGuard();
  const cardNote = card.cardNote?.trim() || resolveOriginCopy(card);

  const handleDelete = (event: React.MouseEvent, cardId: string) => {
    event.stopPropagation();
    onDeleteCard(cardId);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>, codeCard: CodeCard) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    runImpactAction(() => onRunCard(codeCard), { settle: 'none' });
  };

  return (
    <CodeCardFace
      card={card}
      tags={displayTags(card, roomTags, uncategorizedLabel)}
      cardNote={cardNote}
      editing={cardsExpanded}
      active={card.id === activeCardId}
      spotlight={card.id === spotlightCardId}
      data-surface={COLLECTION_FRONTSTAGE_SURFACES.archiveCard}
      role="button"
      tabIndex={0}
      aria-label={t('collection.card.runAria', { title: cleanDisplayText(card.title) })}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={tapIntent.handlePointerDown}
      onPointerMove={tapIntent.handlePointerMove}
      onPointerUp={tapIntent.handlePointerEnd}
      onPointerCancel={tapIntent.handlePointerEnd}
      onClick={(event) => {
        if (!tapIntent.shouldAllowTap()) return;
        runImpactAction(() => onRunCard(card), { element: event.currentTarget });
      }}
      onKeyDown={(event) => handleCardKeyDown(event, card)}
      renderScopedFaceStyle={false}
      resolveTagClassName={(tag) => mutedRoomTagClassName(tag, uncategorizedLabel)}
      leadingControls={cardsExpanded ? (
        <>
          <button
            type="button"
            className="card-delete-badge"
            aria-label={t('collection.card.deleteAria', { title: cleanDisplayText(card.title) })}
            onClick={(event) => {
              runImpactAction(() => handleDelete(event, card.id), { element: event.currentTarget });
            }}
          >
            <Icon name="x" size={10} />
          </button>
          <button
            type="button"
            className={`card-pin-badge ${card.pinnedAt ? 'active' : ''}`}
            aria-label={card.pinnedAt
              ? t('collection.card.unpinAria', { title: cleanDisplayText(card.title) })
              : t('collection.card.pinAria', { title: cleanDisplayText(card.title) })}
            onClick={(event) => {
              event.stopPropagation();
              runSelectionAction(() => onToggleCardPinned(card.id), { element: event.currentTarget });
            }}
          >
            <Icon name="pin" size={12} />
          </button>
        </>
      ) : null}
      trailingControls={!cardsExpanded ? (
        <button
          type="button"
          className="code-card-run-dot"
          aria-label={t('collection.card.editAria', { title: cleanDisplayText(card.title) })}
          onClick={(event) => {
            event.stopPropagation();
            if (card.id === activeCardId) {
              onOpenCard(card.id);
              return;
            }
            runSelectionAction(() => onOpenCard(card.id), { element: event.currentTarget });
          }}
        >
          <Icon name="edit" size={12} />
        </button>
      ) : null}
    />
  );
});

export function CodeCardGrid({
  cardsExpanded,
  viewMode,
  leadingCard,
  roomTags,
  cards,
  projectFiles,
  roomProjects,
  activeCardId,
  spotlightCardId,
  resolveOriginCopy,
  onOpenProject,
  onDeleteProject = () => {},
  onOpenCard,
  onRunCard,
  onDeleteCard,
  onToggleCardPinned,
  onToggleProjectPinned
}: CodeCardGridProps) {
  const { t } = useI18n();
  const uncategorizedLabel = t('collection.card.uncategorized');
  const groupedProjects = useMemo(
    () => roomProjects.map((project) => ({
      project,
      files: resolveRoomProjectFiles(project, projectFiles)
    })),
    [projectFiles, roomProjects]
  );
  const standaloneCards = cards;
  const visibleProjects = groupedProjects;
  const visibleStandaloneCards = viewMode === 'cards' ? standaloneCards : [];
  const gridItems: CodeGridItem[] = useMemo(
    () => [
      ...visibleProjects.map((entry) => ({ kind: 'project' as const, entry })),
      ...visibleStandaloneCards.map((card) => ({ kind: 'card' as const, card }))
    ],
    [visibleProjects, visibleStandaloneCards]
  );
  const visibleItemCount = gridItems.length;
  const virtualWindow = useVirtualCardWindow({
    itemCount: visibleItemCount,
    estimateRowHeight: estimateCodeCardRowHeight,
    minVirtualItems: CODE_CARD_GRID_MIN_VIRTUAL_ITEMS,
    overscanRows: CODE_CARD_GRID_OVERSCAN_ROWS
  });
  const renderedGridItems = useMemo(
    () => gridItems.slice(virtualWindow.startIndex, virtualWindow.endIndex),
    [gridItems, virtualWindow.endIndex, virtualWindow.startIndex]
  );
  const scopedFaceCss = useMemo(
    () => renderedGridItems
      .flatMap((item) => item.kind === 'card' ? [item.card] : [])
      .map((card) => buildScopedCodeCardFaceCss(card.id, card.cardFaceCss, DEFAULT_CODE_CARD_FACE_ROOT_SCOPE))
      .filter(Boolean)
      .join('\n\n'),
    [renderedGridItems]
  );
  const layoutClassName =
    viewMode === 'files'
      ? 'code-card-grid--files'
      : visibleItemCount <= 1
        ? 'code-card-grid--solo'
        : visibleItemCount === 2
          ? 'code-card-grid--duo'
          : 'code-card-grid--masonry';
  return (
    <div ref={virtualWindow.containerRef} className={`grid code-card-grid ${layoutClassName}`.trim()}>
      {scopedFaceCss ? <ScopedCardFaceStyle ownerId="code-card-grid-faces" cssText={scopedFaceCss} /> : null}
      {leadingCard}
      {virtualWindow.topSpacerHeight > 0 ? (
        <div
          className="collection-virtual-spacer code-card-virtual-spacer"
          style={{ height: virtualWindow.topSpacerHeight }}
          aria-hidden="true"
        />
      ) : null}
      {renderedGridItems.map((item) => {
        if (item.kind === 'project') {
          return (
            <RoomProjectCard
              key={item.entry.project.id}
              cardsExpanded={cardsExpanded}
              project={item.entry.project}
              files={item.entry.files}
              onOpenProject={onOpenProject}
              onDeleteProject={onDeleteProject}
              onToggleProjectPinned={onToggleProjectPinned}
            />
          );
        }

        return (
          <CodeCardItem
            key={item.card.id}
            card={item.card}
            cardsExpanded={cardsExpanded}
            roomTags={roomTags}
            activeCardId={activeCardId}
            spotlightCardId={spotlightCardId}
            resolveOriginCopy={resolveOriginCopy}
            onOpenCard={onOpenCard}
            onRunCard={onRunCard}
            onDeleteCard={onDeleteCard}
            onToggleCardPinned={onToggleCardPinned}
            uncategorizedLabel={uncategorizedLabel}
          />
        );
      })}
      {virtualWindow.bottomSpacerHeight > 0 ? (
        <div
          className="collection-virtual-spacer code-card-virtual-spacer"
          style={{ height: virtualWindow.bottomSpacerHeight }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
