import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { canSaveToPhotoAlbum, saveAssetToPhotoAlbum } from '../../../native/photoAlbum';
import type { GroupImageItem } from '../../../app/group/useGroupWorldController';
import { useAssetObjectUrl } from '../../useAssetObjectUrl';

type GroupImagePreviewProps = {
  items: GroupImageItem[];
  activeIndex: number;
  ownerLabel: (item: GroupImageItem) => string | null;
  onChangeIndex: (nextIndex: number) => void;
  onClose: () => void;
  onDelete: (item: GroupImageItem) => void;
  onStatus: (message: string) => void;
};

const PREVIEW_CLOSE_MS = 220;
const SWIPE_THRESHOLD = 56;
const SWIPE_THRESHOLD_RATIO = 0.16;
const DRAG_START_THRESHOLD = 10;
const EDGE_DRAG_DAMPING = 0.28;
const DELETE_DISARM_MS = 2600;

type PreviewPointerState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  deltaX: number;
  dragging: boolean;
};

function GroupPreviewSlide({
  item,
  slideStyle
}: {
  item: GroupImageItem | null;
  slideStyle: CSSProperties;
}) {
  const imageUrl = useAssetObjectUrl(item?.assetId);
  return (
    <div
      className={`asset-preview-slide ${item ? 'has-image' : 'placeholder'}`}
      style={slideStyle}
      aria-hidden={item ? undefined : true}
    >
      {item && imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="asset-preview-image"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
        />
      ) : null}
    </div>
  );
}

export function GroupImagePreview({
  items,
  activeIndex,
  ownerLabel,
  onChangeIndex,
  onClose,
  onDelete,
  onStatus
}: GroupImagePreviewProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<'opening' | 'open' | 'closing'>('opening');
  const [displayIndex, setDisplayIndex] = useState(activeIndex);
  const [trackOffsetPx, setTrackOffsetPx] = useState(0);
  const [trackAnimating, setTrackAnimating] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const suppressCloseRef = useRef(false);
  const pendingIndexRef = useRef<number | null>(null);
  const disarmTimerRef = useRef<number | null>(null);
  const pointerStateRef = useRef<PreviewPointerState>({
    pointerId: null,
    startX: 0,
    startY: 0,
    deltaX: 0,
    dragging: false
  });

  const displayItem = items[displayIndex] ?? null;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => setPhase('open'));
    return () => {
      window.cancelAnimationFrame(frame);
      body.style.overflow = previousOverflow;
    };
  }, []);

  // 父级删除/变更后跟着收敛
  useEffect(() => {
    if (trackAnimating || pointerStateRef.current.dragging) return;
    if (activeIndex === displayIndex) return;
    setDisplayIndex(activeIndex);
    setTrackOffsetPx(0);
  }, [activeIndex, displayIndex, trackAnimating]);

  // 换了张图就解除删除上膛
  useEffect(() => {
    setDeleteArmed(false);
  }, [displayItem?.id]);

  useEffect(() => {
    if (!deleteArmed) return undefined;
    disarmTimerRef.current = window.setTimeout(() => setDeleteArmed(false), DELETE_DISARM_MS);
    return () => {
      if (disarmTimerRef.current !== null) window.clearTimeout(disarmTimerRef.current);
    };
  }, [deleteArmed]);

  const requestClose = () => {
    if (phase === 'closing') return;
    setPhase('closing');
    window.setTimeout(onClose, PREVIEW_CLOSE_MS);
  };

  const getStageWidth = () => {
    const measuredWidth = stageRef.current?.clientWidth ?? 0;
    if (measuredWidth > 0) return measuredWidth;
    if (typeof window !== 'undefined' && window.innerWidth > 0) return window.innerWidth;
    return 390;
  };

  const settleToIndex = (nextIndex: number) => {
    if (trackAnimating) return;
    if (nextIndex < 0 || nextIndex >= items.length || nextIndex === displayIndex) return;
    suppressCloseRef.current = true;
    const stageWidth = getStageWidth();
    pendingIndexRef.current = nextIndex;
    setTrackAnimating(true);
    setTrackOffsetPx(nextIndex > displayIndex ? -stageWidth : stageWidth);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        settleToIndex(displayIndex - 1);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        settleToIndex(displayIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (typeof document === 'undefined' || !displayItem) return null;

  const resetPointerState = () => {
    pointerStateRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      deltaX: 0,
      dragging: false
    };
  };

  const handleStageClick = () => {
    if (suppressCloseRef.current) {
      suppressCloseRef.current = false;
      return;
    }
    requestClose();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (trackAnimating) return;
    pointerStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
      dragging: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointerState = pointerStateRef.current;
    if (pointerState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pointerState.startX;
    const deltaY = event.clientY - pointerState.startY;
    pointerState.deltaX = deltaX;

    if (!pointerState.dragging) {
      if (Math.abs(deltaX) < DRAG_START_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      pointerState.dragging = true;
      suppressCloseRef.current = true;
      setTrackAnimating(false);
    }

    event.preventDefault();
    const canMovePrev = displayIndex > 0;
    const canMoveNext = displayIndex < items.length - 1;
    let nextOffset = deltaX;
    if ((deltaX > 0 && !canMovePrev) || (deltaX < 0 && !canMoveNext)) {
      nextOffset *= EDGE_DRAG_DAMPING;
    }
    setTrackOffsetPx(nextOffset);
  };

  const handlePointerRelease = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointerState = pointerStateRef.current;
    if (pointerState.pointerId !== event.pointerId) return;
    if (!pointerState.dragging) {
      resetPointerState();
      return;
    }

    event.preventDefault();
    suppressCloseRef.current = true;

    const stageWidth = getStageWidth();
    const commitThreshold = Math.max(SWIPE_THRESHOLD, stageWidth * SWIPE_THRESHOLD_RATIO);
    const deltaX = pointerState.deltaX;
    const canMovePrev = displayIndex > 0;
    const canMoveNext = displayIndex < items.length - 1;

    let nextIndex = displayIndex;
    let targetOffset = 0;
    if (Math.abs(deltaX) >= commitThreshold) {
      if (deltaX < 0 && canMoveNext) {
        nextIndex = displayIndex + 1;
        targetOffset = -stageWidth;
      } else if (deltaX > 0 && canMovePrev) {
        nextIndex = displayIndex - 1;
        targetOffset = stageWidth;
      }
    }

    pendingIndexRef.current = nextIndex !== displayIndex ? nextIndex : null;
    setTrackAnimating(true);
    setTrackOffsetPx(targetOffset);
    resetPointerState();
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStateRef.current.pointerId !== event.pointerId) return;
    if (pointerStateRef.current.dragging) {
      suppressCloseRef.current = true;
      pendingIndexRef.current = null;
      setTrackAnimating(true);
      setTrackOffsetPx(0);
    }
    resetPointerState();
  };

  const stopBarPointer = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const saveCurrentImage = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const destination = await saveAssetToPhotoAlbum(displayItem.assetId);
      onStatus(destination === 'album' ? t('group.images.savedToAlbum') : t('group.images.downloadStarted'));
    } catch {
      onStatus(t('group.images.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const previousItem = displayIndex > 0 ? items[displayIndex - 1] ?? null : null;
  const nextItem = displayIndex < items.length - 1 ? items[displayIndex + 1] ?? null : null;
  const signature = ownerLabel(displayItem);

  const buildSlideStyle = (slot: -1 | 0 | 1): CSSProperties => ({
    transform: `translate3d(calc(${slot * 100}% + ${trackOffsetPx}px), 0, 0)`
  });

  return createPortal(
    <div
      className={`asset-preview-overlay group-image-viewer ${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('group.images.viewerAria')}
      onClick={handleStageClick}
    >
      <div
        ref={stageRef}
        className={[
          'asset-preview-stage',
          trackAnimating ? 'is-animating' : '',
          pointerStateRef.current.dragging ? 'is-dragging' : ''
        ].filter(Boolean).join(' ')}
        onClick={(event) => {
          event.stopPropagation();
          handleStageClick();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerRelease}
        onPointerCancel={handlePointerCancel}
        onTransitionEnd={(event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.classList.contains('asset-preview-slide')) return;
          if (!trackAnimating) return;
          const nextIndex = pendingIndexRef.current;
          pendingIndexRef.current = null;
          setTrackAnimating(false);
          if (nextIndex === null) {
            setTrackOffsetPx(0);
            return;
          }
          setDisplayIndex(nextIndex);
          setTrackOffsetPx(0);
          onChangeIndex(nextIndex);
        }}
      >
        <GroupPreviewSlide
          key={previousItem?.id ?? `group-preview-empty-previous-${displayIndex}`}
          item={previousItem}
          slideStyle={buildSlideStyle(-1)}
        />
        <GroupPreviewSlide
          key={displayItem.id}
          item={displayItem}
          slideStyle={buildSlideStyle(0)}
        />
        <GroupPreviewSlide
          key={nextItem?.id ?? `group-preview-empty-next-${displayIndex}`}
          item={nextItem}
          slideStyle={buildSlideStyle(1)}
        />
        <div
          className="group-image-viewer-bar"
          onPointerDown={stopBarPointer}
          onPointerMove={stopBarPointer}
          onPointerUp={stopBarPointer}
          onPointerCancel={stopBarPointer}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <span className="group-image-viewer-meta">
            {signature ? <strong>{signature}</strong> : null}
            <span>{displayIndex + 1} / {items.length}</span>
          </span>
          <div className="group-image-viewer-actions">
            <button
              type="button"
              className="group-image-viewer-btn"
              disabled={saving}
              onClick={() => void saveCurrentImage()}
            >
              <Icon name={canSaveToPhotoAlbum() ? 'image' : 'download'} size={14} />
              <span>{canSaveToPhotoAlbum() ? t('group.images.saveToAlbum') : t('group.images.download')}</span>
            </button>
            <button
              type="button"
              className={`group-image-viewer-btn is-danger ${deleteArmed ? 'is-armed' : ''}`}
              onClick={() => {
                if (!deleteArmed) {
                  setDeleteArmed(true);
                  return;
                }
                setDeleteArmed(false);
                onDelete(displayItem);
              }}
            >
              <Icon name="trash" size={14} />
              <span>{deleteArmed ? t('group.cards.deleteConfirm') : t('group.message.delete')}</span>
            </button>
          </div>
        </div>
        <button
          type="button"
          className="group-image-viewer-close"
          onClick={(event) => {
            event.stopPropagation();
            requestClose();
          }}
          aria-label={t('group.create.cancel')}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>,
    document.body
  );
}
