import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQrCodeAttachment } from './attachmentToolExecutor';

const { toDataURL, createStoredAttachmentFromDataUrl } = vi.hoisted(() => ({
  toDataURL: vi.fn(async () => 'data:image/png;base64,qr'),
  createStoredAttachmentFromDataUrl: vi.fn(async () => ({
    id: 'attachment-qr',
    assetId: 'asset-qr',
    kind: 'image' as const,
    name: 'gift.png',
    mimeType: 'image/png',
    size: 12
  }))
}));

vi.mock('qrcode', () => ({
  toDataURL
}));

vi.mock('../infrastructure/assetStore', () => ({
  createStoredAttachment: vi.fn(),
  createStoredAttachmentFromDataUrl,
  getAssetBlob: vi.fn()
}));

describe('createQrCodeAttachment', () => {
  beforeEach(() => {
    toDataURL.mockClear();
    createStoredAttachmentFromDataUrl.mockClear();
  });

  it('keeps the qr payload out of the returned detail text', async () => {
    const result = await createQrCodeAttachment('https://secret.example/surprise', 'gift.png');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detailText).toBe('二维码已经生成。收藏这张图片后，可以在图片收藏里长按直接扫码。');
    expect(result.detailText).not.toContain('https://secret.example/surprise');
    expect(toDataURL).toHaveBeenCalledWith('https://secret.example/surprise', expect.any(Object));
  });
});
