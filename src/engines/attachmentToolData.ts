import type { AttachmentEntry } from './attachmentToolEntries';

export function normalizeArchiveName(name?: string) {
  const trimmed = name?.trim() || 'polaris-attachments.zip';
  return trimmed.toLowerCase().endsWith('.zip') ? trimmed : `${trimmed}.zip`;
}

export function normalizeQrFileName(fileName?: string) {
  const trimmed = fileName?.trim() || 'polaris-qr.png';
  return trimmed.toLowerCase().endsWith('.png') ? trimmed : `${trimmed}.png`;
}

export function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor((base64.length * 3) / 4);
}

export function decodeDataUrl(dataUrl: string) {
  const [, base64 = ''] = dataUrl.split(',');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array) {
  let output = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    output += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(output);
}

export function resolveBundledFileName(entry: AttachmentEntry) {
  if (entry.kind === 'image') return entry.name;
  if (entry.mimeType.includes('zip')) {
    return entry.name.replace(/\.zip$/i, '') + '.txt';
  }
  return entry.name;
}

export function formatArchiveEntrySize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}
