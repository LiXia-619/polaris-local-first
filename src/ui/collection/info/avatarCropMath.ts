export const AVATAR_CROP_FRAME_SIZE = 248;
export const AVATAR_CROP_EXPORT_SIZE = 512;
export const AVATAR_CROP_MIN_ZOOM = 1;
export const AVATAR_CROP_MAX_ZOOM = 3;

type AvatarCropGeometry = {
  frameSize: number;
  imageWidth: number;
  imageHeight: number;
  zoom: number;
};

type AvatarCropOffsetInput = AvatarCropGeometry & {
  x: number;
  y: number;
};

export function clampAvatarZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return AVATAR_CROP_MIN_ZOOM;
  return Math.min(AVATAR_CROP_MAX_ZOOM, Math.max(AVATAR_CROP_MIN_ZOOM, zoom));
}

export function resolveAvatarCoverScale(imageWidth: number, imageHeight: number, frameSize: number) {
  if (imageWidth <= 0 || imageHeight <= 0 || frameSize <= 0) return 1;
  return Math.max(frameSize / imageWidth, frameSize / imageHeight);
}

export function clampAvatarOffset({
  frameSize,
  imageWidth,
  imageHeight,
  zoom,
  x,
  y
}: AvatarCropOffsetInput) {
  const safeZoom = clampAvatarZoom(zoom);
  const coverScale = resolveAvatarCoverScale(imageWidth, imageHeight, frameSize);
  const displayWidth = imageWidth * coverScale * safeZoom;
  const displayHeight = imageHeight * coverScale * safeZoom;
  const maxOffsetX = Math.max(0, (displayWidth - frameSize) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - frameSize) / 2);

  return {
    x: Math.min(maxOffsetX, Math.max(-maxOffsetX, x)),
    y: Math.min(maxOffsetY, Math.max(-maxOffsetY, y))
  };
}

export function resolveAvatarSourceRect({
  frameSize,
  imageWidth,
  imageHeight,
  zoom,
  x,
  y
}: AvatarCropOffsetInput) {
  const safeZoom = clampAvatarZoom(zoom);
  const clampedOffset = clampAvatarOffset({
    frameSize,
    imageWidth,
    imageHeight,
    zoom: safeZoom,
    x,
    y
  });
  const coverScale = resolveAvatarCoverScale(imageWidth, imageHeight, frameSize) * safeZoom;
  const sourceSize = Math.min(imageWidth, imageHeight, frameSize / coverScale);
  const sourceX = Math.min(
    imageWidth - sourceSize,
    Math.max(0, imageWidth / 2 - sourceSize / 2 - clampedOffset.x / coverScale)
  );
  const sourceY = Math.min(
    imageHeight - sourceSize,
    Math.max(0, imageHeight / 2 - sourceSize / 2 - clampedOffset.y / coverScale)
  );

  return {
    sourceX,
    sourceY,
    sourceSize,
    offsetX: clampedOffset.x,
    offsetY: clampedOffset.y
  };
}

