import { createStoredAttachment, createStoredAttachmentFromDataUrl, getAssetBlob } from '../infrastructure/assetStore';
import type { ToolResult } from './toolResult';
import type { ChatAttachment, ChatMessage } from '../types/domain';
import {
  bundleAttachmentArchiveEntries,
  inspectAttachmentArchiveEntries,
  readAttachmentArchiveEntryText,
  type BundleArchiveEntriesResult,
  type InspectArchiveEntriesResult,
  type ReadArchiveEntryTextResult
} from './attachmentArchiveTools';
import {
  type AttachmentEntry,
  filterAttachmentEntries,
  resolveReadableTargetEntry,
  toAttachmentEntries,
  type ToolAttachmentRef
} from './attachmentToolEntries';
import { formatAttachmentSize } from './attachmentFormat';
import {
  normalizeArchiveName,
  normalizeQrFileName,
  resolveBundledFileName
} from './attachmentToolData';
export type { ReadWebPageResult } from './webSearchTool';

export type { ToolAttachmentRef } from './attachmentToolEntries';

export type InspectAttachmentsResult = ToolResult<{
  items: ToolAttachmentRef[];
  detailText: string;
}>;

export type ReadAttachmentTextResult = ToolResult<{
  attachment: ToolAttachmentRef;
  detailText: string;
}>;
export type {
  BundleArchiveEntriesResult,
  InspectArchiveEntriesResult,
  ReadArchiveEntryTextResult
};

export type BundleAttachmentsResult = ToolResult<{
  attachment: ChatAttachment;
  itemCount: number;
  detailText: string;
}>;

export type CreateQrCodeResult = ToolResult<{
  attachment: ChatAttachment;
  detailText: string;
}>;

export type SendImageAttachmentResult = ToolResult<{
  attachment: ChatAttachment;
  detailText: string;
}>;

export function inspectConversationAttachments(
  messages: ChatMessage[],
  scope: 'latest' | 'all' = 'latest',
  query?: string
): InspectAttachmentsResult {
  const entries = filterAttachmentEntries(toAttachmentEntries(messages, scope), query);
  if (!entries.length) {
    return {
      ok: false,
      error: query ? `没有找到和“${query}”匹配的附件。` : '当前没有可用附件。'
    };
  }

  return {
    ok: true,
    items: entries.map(({ attachment: _attachment, ...entry }) => entry),
    detailText: entries
      .map(
        (entry, index) =>
          `${index + 1}. ${entry.name} [${entry.kind === 'image' ? '图片' : '文件'}] · id=${entry.id} · ${formatAttachmentSize(entry.size)}${entry.mimeType.toLowerCase().includes('zip') && entry.attachment.assetId ? ' · 可浏览压缩包' : ''}${entry.hasText ? ' · 可读文本' : ''}`
      )
      .join('\n')
  };
}

export function readConversationAttachmentText(
  messages: ChatMessage[],
  target?: string,
  maxChars?: number
): ReadAttachmentTextResult {
  const resolved = resolveReadableTargetEntry(toAttachmentEntries(messages, 'all'), target);
  if (!resolved.ok) return resolved;

  const rawText = resolved.entry.attachment.textContent?.trim() ?? '';
  const limit = Number.isFinite(maxChars) && typeof maxChars === 'number' && maxChars > 0
    ? Math.floor(maxChars)
    : null;
  const text = limit === null ? rawText : rawText.slice(0, limit).trim();
  const detailText = [`附件：${resolved.entry.name}`, '', text];
  if (limit !== null && text.length < rawText.length) {
    detailText.push('', `[内容已截断，原始长度 ${rawText.length.toLocaleString('zh-CN')} 字]`);
  }

  return {
    ok: true,
    attachment: (({ attachment: _attachment, ...entry }) => entry)(resolved.entry),
    detailText: detailText.join('\n')
  };
}

export async function bundleConversationAttachments(
  messages: ChatMessage[],
  targets?: string[],
  archiveName?: string
): Promise<BundleAttachmentsResult> {
  const entries = toAttachmentEntries(messages, 'latest');
  const selected =
    targets && targets.length > 0
      ? entries.filter((entry) => targets.some((target) => filterAttachmentEntries([entry], target).length > 0))
      : entries;

  if (!selected.length) {
    return { ok: false, error: '最近一条带附件的消息里没有可打包的附件。' };
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  let bundledCount = 0;

  for (const entry of selected) {
    if (entry.kind === 'image' && entry.attachment.assetId) {
      const blob = await getAssetBlob(entry.attachment.assetId);
      if (!blob) continue;
      zip.file(resolveBundledFileName(entry), await blob.arrayBuffer());
      bundledCount += 1;
      continue;
    }
    if (entry.attachment.textContent?.trim()) {
      zip.file(resolveBundledFileName(entry), entry.attachment.textContent);
      bundledCount += 1;
    }
  }

  if (bundledCount === 0) {
    return { ok: false, error: '这些附件里没有可重新打包的文本或图片内容。' };
  }

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const name = normalizeArchiveName(archiveName);
  return {
    ok: true,
    itemCount: bundledCount,
    attachment: await createStoredAttachment({
      kind: 'file',
      name,
      mimeType: 'application/zip',
      blob: new Blob([bytes as BlobPart], { type: 'application/zip' })
    }),
    detailText: `已打包 ${bundledCount} 个附件：${selected
      .slice(0, bundledCount)
      .map((entry) => entry.name)
      .join('、')}`
  };
}

export async function inspectConversationArchiveEntries(
  messages: ChatMessage[],
  target?: string,
  query?: string
): Promise<InspectArchiveEntriesResult> {
  return await inspectAttachmentArchiveEntries(messages, target, query);
}

export async function readConversationArchiveEntryText(
  messages: ChatMessage[],
  target?: string,
  entry?: string,
  maxChars?: number
): Promise<ReadArchiveEntryTextResult> {
  return await readAttachmentArchiveEntryText(messages, target, entry, maxChars);
}

export async function bundleConversationArchiveEntries(
  messages: ChatMessage[],
  target?: string,
  entries?: string[],
  prefixes?: string[],
  excludeEntries?: string[],
  excludePrefixes?: string[],
  archiveName?: string
): Promise<BundleArchiveEntriesResult> {
  return await bundleAttachmentArchiveEntries(
    messages,
    target,
    entries,
    prefixes,
    excludeEntries,
    excludePrefixes,
    archiveName
  );
}

export async function createQrCodeAttachment(
  text: string,
  fileName?: string
): Promise<CreateQrCodeResult> {
  const payload = text.trim();
  if (!payload) return { ok: false, error: '二维码内容不能为空。' };

  try {
    const { toDataURL } = await import('qrcode');
    const dataUrl = await toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512
    });

    return {
      ok: true,
      attachment: await createStoredAttachmentFromDataUrl({
        kind: 'image',
        name: normalizeQrFileName(fileName),
        mimeType: 'image/png',
        dataUrl
      }),
      detailText: '二维码已经生成。收藏这张图片后，可以在图片收藏里长按直接扫码。'
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `二维码生成失败：${error.message}` : '二维码生成失败。'
    };
  }
}
