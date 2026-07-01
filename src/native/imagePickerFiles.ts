import {
  Camera,
  CameraDirection,
  CameraResultType,
  CameraSource,
  type GalleryPhoto,
  type Photo
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

function normalizeImageMime(format: string) {
  const normalized = format.trim().toLowerCase();
  if (normalized === 'jpg') return 'image/jpeg';
  if (normalized === 'jpeg' || normalized === 'png' || normalized === 'gif' || normalized === 'webp') {
    return `image/${normalized}`;
  }
  return 'image/jpeg';
}

function buildImageFileName(prefix: string, format: string, index = 0) {
  const stamp = Date.now();
  const ext = format.trim().toLowerCase() || 'jpeg';
  return `${prefix}-${stamp}${index > 0 ? `-${index + 1}` : ''}.${ext}`;
}

async function toFileFromWebPath(
  webPath: string,
  fileName: string,
  mimeType: string
) {
  const response = await fetch(webPath);
  if (!response.ok) {
    throw new Error('读取图片失败。');
  }
  const blob = await response.blob();
  return new File([blob], fileName, {
    type: blob.type || mimeType
  });
}

async function toFileFromPhoto(photo: Photo) {
  if (!photo.webPath) {
    throw new Error('无法读取这张照片，请重新选择一次。');
  }
  return toFileFromWebPath(
    photo.webPath,
    buildImageFileName('camera', photo.format),
    normalizeImageMime(photo.format)
  );
}

async function toFileFromGalleryPhoto(photo: GalleryPhoto, index: number) {
  return toFileFromWebPath(
    photo.webPath,
    buildImageFileName('photo', photo.format, index),
    normalizeImageMime(photo.format)
  );
}

export function canUseNativeCameraCapture() {
  return Capacitor.isNativePlatform() && ['android', 'ios'].includes(Capacitor.getPlatform());
}

export function canUseNativePhotoLibraryPicker() {
  return Capacitor.isNativePlatform() && ['android', 'ios'].includes(Capacitor.getPlatform());
}

export async function captureNativePhotoFile() {
  const photo = await Camera.getPhoto({
    quality: 92,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    direction: CameraDirection.Rear,
    presentationStyle: 'fullscreen'
  });
  return await toFileFromPhoto(photo);
}

export async function pickNativePhotoLibraryFiles() {
  const result = await Camera.pickImages({
    quality: 92,
    presentationStyle: 'fullscreen'
  });
  return await Promise.all(result.photos.map((photo, index) => toFileFromGalleryPhoto(photo, index)));
}
