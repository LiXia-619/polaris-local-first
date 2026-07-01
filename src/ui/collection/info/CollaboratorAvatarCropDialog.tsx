import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { AvatarShape } from '../../../types/domain';
import { useI18n } from '../../../i18n/useI18n';
import { runSuccessAction, selectionHaptic } from '../../haptics';
import {
  AVATAR_CROP_EXPORT_SIZE,
  AVATAR_CROP_FRAME_SIZE,
  clampAvatarOffset,
  clampAvatarZoom,
  resolveAvatarCoverScale,
  resolveAvatarSourceRect
} from './avatarCropMath';

type CollaboratorAvatarCropDialogProps = {
  file: File;
  label: string;
  shape: AvatarShape;
  onCancel: () => void;
  onConfirm: (files: File[]) => Promise<void>;
};

type CropOffset = {
  x: number;
  y: number;
};

type ImageSize = {
  width: number;
  height: number;
};

type PointerDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: CropOffset;
};

function loadImageElement(url: string, errorMessage: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(errorMessage));
    image.src = url;
  });
}

async function renderCroppedAvatarFile(args: {
  file: File;
  imageUrl: string;
  imageSize: ImageSize;
  zoom: number;
  offset: CropOffset;
  loadFailedMessage: string;
  cropFailedMessage: string;
}) {
  const image = await loadImageElement(args.imageUrl, args.loadFailedMessage);
  const source = resolveAvatarSourceRect({
    frameSize: AVATAR_CROP_FRAME_SIZE,
    imageWidth: args.imageSize.width,
    imageHeight: args.imageSize.height,
    zoom: args.zoom,
    x: args.offset.x,
    y: args.offset.y
  });
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_CROP_EXPORT_SIZE;
  canvas.height = AVATAR_CROP_EXPORT_SIZE;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error(args.cropFailedMessage);
  }

  context.drawImage(
    image,
    source.sourceX,
    source.sourceY,
    source.sourceSize,
    source.sourceSize,
    0,
    0,
    AVATAR_CROP_EXPORT_SIZE,
    AVATAR_CROP_EXPORT_SIZE
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error(args.cropFailedMessage));
        return;
      }
      resolve(nextBlob);
    }, 'image/png');
  });

  const baseName = args.file.name.replace(/\.[^.]+$/, '') || 'avatar';
  return new File([blob], `${baseName}-avatar.png`, { type: 'image/png' });
}

export function CollaboratorAvatarCropDialog({
  file,
  label,
  shape,
  onCancel,
  onConfirm
}: CollaboratorAvatarCropDialogProps) {
  const { t } = useI18n();
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<PointerDragState | null>(null);
  const [saving, setSaving] = useState(false);
  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    let cancelled = false;
    void loadImageElement(imageUrl, t('collaborator.avatar.cropLoadFailed')).then((image) => {
      if (cancelled) return;
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }).catch(() => {
      if (cancelled) return;
      setImageSize(null);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!imageSize) return;
    setOffset((current) => clampAvatarOffset({
      frameSize: AVATAR_CROP_FRAME_SIZE,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      zoom,
      x: current.x,
      y: current.y
    }));
  }, [imageSize, zoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, saving]);

  const displayGeometry = useMemo(() => {
    if (!imageSize) return null;
    const coverScale = resolveAvatarCoverScale(imageSize.width, imageSize.height, AVATAR_CROP_FRAME_SIZE);
    return {
      width: imageSize.width * coverScale,
      height: imageSize.height * coverScale
    };
  }, [imageSize]);

  const updateZoom = (nextZoom: number) => {
    if (!imageSize) return;
    const safeZoom = clampAvatarZoom(nextZoom);
    setZoom(safeZoom);
    setOffset((current) => clampAvatarOffset({
      frameSize: AVATAR_CROP_FRAME_SIZE,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      zoom: safeZoom,
      x: current.x,
      y: current.y
    }));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageSize || saving) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offset
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageSize || !dragState || dragState.pointerId !== event.pointerId) return;
    const nextX = dragState.startOffset.x + (event.clientX - dragState.startX);
    const nextY = dragState.startOffset.y + (event.clientY - dragState.startY);
    setOffset(clampAvatarOffset({
      frameSize: AVATAR_CROP_FRAME_SIZE,
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      zoom,
      x: nextX,
      y: nextY
    }));
  };

  const clearDragState = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && dragState && dragState.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!imageSize || saving) return;
    event.preventDefault();
    updateZoom(zoom - event.deltaY * 0.0018);
  };

  const handleReset = () => {
    void selectionHaptic();
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    if (!imageSize || saving) return;
    try {
      setSaving(true);
      const croppedFile = await renderCroppedAvatarFile({
        file,
        imageUrl,
        imageSize,
        zoom,
        offset,
        loadFailedMessage: t('collaborator.avatar.cropLoadFailed'),
        cropFailedMessage: t('collaborator.avatar.cropFailed')
      });
      await runSuccessAction(() => onConfirm([croppedFile]));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="settings-overlay collaborator-avatar-crop-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onCancel();
        }
      }}
    >
      <div
        className="settings-sheet collaborator-avatar-crop-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('collaborator.avatar.cropAria', { label })}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="collaborator-avatar-crop-head">
          <strong>{label}</strong>
          <p>{t('collaborator.avatar.cropHelp')}</p>
        </div>

        <div className="collaborator-avatar-crop-stage">
          <div
            className="collaborator-avatar-crop-window"
            data-avatar-shape={shape}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={clearDragState}
            onPointerCancel={clearDragState}
            onWheel={handleWheel}
          >
            {displayGeometry ? (
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                className="collaborator-avatar-crop-image"
                style={{
                  width: `${displayGeometry.width}px`,
                  height: `${displayGeometry.height}px`,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
                }}
              />
            ) : (
              <div className="collaborator-avatar-crop-loading">{t('collaborator.avatar.cropLoading')}</div>
            )}
          </div>
        </div>

        <div className="collaborator-avatar-crop-controls">
          <div className="collaborator-avatar-crop-zoom-row">
            <span>{t('collaborator.avatar.zoomOut')}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => updateZoom(Number(event.target.value))}
              aria-label={t('collaborator.avatar.zoomAria')}
            />
            <span>{t('collaborator.avatar.zoomIn')}</span>
          </div>
          <div className="collaborator-avatar-crop-actions">
            <button type="button" className="btn-secondary compact" onClick={handleReset} disabled={saving}>
              {t('collaborator.avatar.reset')}
            </button>
            <button type="button" className="btn-secondary compact" onClick={onCancel} disabled={saving}>
              {t('collaborator.avatar.cancel')}
            </button>
            <button type="button" className="btn-secondary compact active" onClick={() => { void handleSave(); }} disabled={!imageSize || saving}>
              {saving ? t('collaborator.avatar.saving') : t('collaborator.avatar.save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
