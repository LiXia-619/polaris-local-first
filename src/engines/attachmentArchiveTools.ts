import { inferCodeLanguage } from './codeCardEngine';
import {
  formatArchiveEntrySize,
  normalizeArchiveName
} from './attachmentToolData';
import { createStoredAttachment, getAssetBlob } from '../infrastructure/assetStore';
import type { ToolResult } from './toolResult';
import {
  resolveAttachmentTargetEntry,
  toAttachmentEntries,
  type AttachmentEntry,
  type ToolAttachmentRef
} from './attachmentToolEntries';
import { formatAttachmentSize } from './attachmentFormat';
import type { ChatAttachment, ChatMessage } from '../types/domain';

const ARCHIVE_TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'html',
  'xml',
  'yml',
  'yaml',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'sh',
  'sql',
  'csv'
]);

export type ArchiveEntryRef = {
  path: string;
  size: number;
  hasText: boolean;
};

export type InspectArchiveEntriesResult = ToolResult<{
  attachment: ToolAttachmentRef;
  entries: ArchiveEntryRef[];
  detailText: string;
}>;

export type ReadArchiveEntryTextResult = ToolResult<{
  attachment: ToolAttachmentRef;
  entry: ArchiveEntryRef;
  text: string;
  inferredLanguage: string;
  detailText: string;
}>;

export type BundleArchiveEntriesResult = ToolResult<{
  sourceAttachment: ToolAttachmentRef;
  attachment: ChatAttachment;
  entries: ArchiveEntryRef[];
  detailText: string;
}>;

function getArchiveExtension(path: string) {
  const match = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function isTextLikeArchiveEntry(path: string) {
  return ARCHIVE_TEXT_EXTENSIONS.has(getArchiveExtension(path));
}

function toAttachmentRef(entry: AttachmentEntry): ToolAttachmentRef {
  const { attachment: _attachment, messageId: _messageId, role: _role, attachmentIndex: _attachmentIndex, ...ref } = entry;
  return ref;
}

async function loadArchive(entry: AttachmentEntry) {
  if (!entry.attachment.assetId || !entry.mimeType.toLowerCase().includes('zip')) {
    throw new Error('这个附件不是可浏览的 zip。');
  }
  const { default: JSZip } = await import('jszip');
  const blob = await getAssetBlob(entry.attachment.assetId);
  if (!blob) {
    throw new Error('这个 zip 附件的资产内容丢失了。');
  }
  return await JSZip.loadAsync(await blob.arrayBuffer());
}

async function listArchiveEntries(entry: AttachmentEntry) {
  const zip = await loadArchive(entry);
  return Object.values(zip.files)
    .filter((item) => !item.dir)
    .map((item) => {
      const internalData = item as typeof item & { _data?: { uncompressedSize?: number } };
      return {
        path: item.name,
        size: typeof internalData._data?.uncompressedSize === 'number' ? internalData._data.uncompressedSize : 0,
        hasText: isTextLikeArchiveEntry(item.name)
      };
    });
}

function pickArchiveAttachment(messages: ChatMessage[], target?: string) {
  return resolveAttachmentTargetEntry(toAttachmentEntries(messages, 'all'), target, {
    noun: 'zip 附件',
    kind: 'file',
    matcher: (entry) => entry.mimeType.toLowerCase().includes('zip') && Boolean(entry.attachment.assetId)
  });
}

function filterArchiveEntries(entries: ArchiveEntryRef[], query?: string) {
  if (!query?.trim()) return entries;
  const normalized = query.trim().toLowerCase();
  return entries.filter((entry) => {
    const path = entry.path.trim().toLowerCase();
    return path === normalized || path.includes(normalized);
  });
}

function filterArchiveEntriesByPrefix(entries: ArchiveEntryRef[], prefix: string) {
  const normalized = prefix.trim().toLowerCase().replace(/^\/+/, '');
  if (!normalized) return [];
  const normalizedDir = normalized.endsWith('/') ? normalized : `${normalized}/`;
  return entries.filter((entry) => {
    const path = entry.path.trim().toLowerCase();
    return path === normalized || path.startsWith(normalizedDir);
  });
}

function resolveArchiveEntriesForBundle(
  entries: ArchiveEntryRef[],
  targets?: string[],
  prefixes?: string[],
  excludeTargets?: string[],
  excludePrefixes?: string[]
) {
  const normalizedTargets = targets?.map((item) => item.trim()).filter(Boolean) ?? [];
  const normalizedPrefixes = prefixes?.map((item) => item.trim()).filter(Boolean) ?? [];

  if (!normalizedTargets.length && !normalizedPrefixes.length) {
    return { ok: true as const, entries };
  }

  const selected = new Map<string, ArchiveEntryRef>();
  for (const target of normalizedTargets) {
    const matches = filterArchiveEntries(entries, target);
    if (!matches.length) {
      return { ok: false as const, error: `压缩包里没有和“${target}”匹配的文件。` };
    }
    for (const match of matches) {
      selected.set(match.path, match);
    }
  }

  for (const prefix of normalizedPrefixes) {
    const matches = filterArchiveEntriesByPrefix(entries, prefix);
    if (!matches.length) {
      return { ok: false as const, error: `压缩包里没有位于“${prefix}”下的文件。` };
    }
    for (const match of matches) {
      selected.set(match.path, match);
    }
  }

  if (!selected.size) {
    return { ok: false as const, error: '没有选中任何可重新打包的包内文件。' };
  }

  const excludedPaths = new Set<string>();
  for (const target of excludeTargets?.map((item) => item.trim()).filter(Boolean) ?? []) {
    for (const match of filterArchiveEntries(entries, target)) {
      excludedPaths.add(match.path);
    }
  }
  for (const prefix of excludePrefixes?.map((item) => item.trim()).filter(Boolean) ?? []) {
    for (const match of filterArchiveEntriesByPrefix(entries, prefix)) {
      excludedPaths.add(match.path);
    }
  }

  const remainingEntries = [...selected.values()].filter((entry) => !excludedPaths.has(entry.path));
  if (!remainingEntries.length) {
    return { ok: false as const, error: '排除规则把可打包的包内文件都筛空了。' };
  }

  return { ok: true as const, entries: remainingEntries };
}

function resolveArchiveEntry(entries: ArchiveEntryRef[], target?: string) {
  const readableEntries = entries.filter((entry) => entry.hasText);
  if (!readableEntries.length) {
    return { ok: false as const, error: '这个压缩包里没有可读取的文本/代码文件。' };
  }
  if (!target?.trim()) {
    if (readableEntries.length === 1) return { ok: true as const, entry: readableEntries[0] };
    return {
      ok: false as const,
      error: `可读文件不止一个，请指定 entry。当前有：${readableEntries.map((entry) => entry.path).join('、')}`
    };
  }

  const matches = filterArchiveEntries(readableEntries, target);
  if (matches.length === 1) return { ok: true as const, entry: matches[0] };
  if (matches.length > 1) {
    return {
      ok: false as const,
      error: `“${target}”匹配到多个包内文件：${matches.map((entry) => entry.path).join('、')}`
    };
  }
  return { ok: false as const, error: `没有找到名为“${target}”的包内文本文件。` };
}

export async function inspectAttachmentArchiveEntries(
  messages: ChatMessage[],
  target?: string,
  query?: string
): Promise<InspectArchiveEntriesResult> {
  const resolved = pickArchiveAttachment(messages, target);
  if (!resolved.ok) return resolved;

  const archiveEntries = filterArchiveEntries(await listArchiveEntries(resolved.entry), query);
  if (!archiveEntries.length) {
    return {
      ok: false,
      error: query ? `压缩包里没有和“${query}”匹配的文件。` : '这个压缩包里没有可浏览的文件。'
    };
  }

  return {
    ok: true,
    attachment: toAttachmentRef(resolved.entry),
    entries: archiveEntries,
    detailText: [
      `压缩包：${resolved.entry.name} · ${formatAttachmentSize(resolved.entry.size)}`,
      ...archiveEntries.map(
        (entry, index) =>
          `${index + 1}. ${entry.path} · ${formatArchiveEntrySize(entry.size)}${entry.hasText ? ' · 可读文本' : ''}`
      )
    ].join('\n')
  };
}

export async function readAttachmentArchiveEntryText(
  messages: ChatMessage[],
  target?: string,
  entryTarget?: string,
  maxChars?: number
): Promise<ReadArchiveEntryTextResult> {
  const resolvedAttachment = pickArchiveAttachment(messages, target);
  if (!resolvedAttachment.ok) return resolvedAttachment;

  const archiveEntries = await listArchiveEntries(resolvedAttachment.entry);
  const resolvedEntry = resolveArchiveEntry(archiveEntries, entryTarget);
  if (!resolvedEntry.ok) return resolvedEntry;

  const zip = await loadArchive(resolvedAttachment.entry);
  const zipEntry = zip.file(resolvedEntry.entry.path);
  if (!zipEntry) {
    return { ok: false, error: `没有找到 ${resolvedEntry.entry.path}。` };
  }

  const rawText = (await zipEntry.async('string')).replace(/\u0000/g, '').trim();
  if (!rawText) {
    return { ok: false, error: `${resolvedEntry.entry.path} 没有可读取的文本内容。` };
  }
  const limit = Number.isFinite(maxChars) && typeof maxChars === 'number' && maxChars > 0
    ? Math.floor(maxChars)
    : null;
  const text = limit === null ? rawText : rawText.slice(0, limit).trim();
  const inferredLanguage = inferCodeLanguage(text, getArchiveExtension(resolvedEntry.entry.path));
  const detailText = [
    `压缩包：${resolvedAttachment.entry.name}`,
    `文件：${resolvedEntry.entry.path}`,
    '',
    text
  ];
  if (limit !== null && text.length < rawText.length) {
    detailText.push('', `[内容已截断，原始长度 ${rawText.length.toLocaleString('zh-CN')} 字]`);
  }

  return {
    ok: true,
    attachment: toAttachmentRef(resolvedAttachment.entry),
    entry: resolvedEntry.entry,
    text,
    inferredLanguage,
    detailText: detailText.join('\n')
  };
}

export async function bundleAttachmentArchiveEntries(
  messages: ChatMessage[],
  target?: string,
  entryTargets?: string[],
  entryPrefixes?: string[],
  excludeTargets?: string[],
  excludeEntryPrefixes?: string[],
  archiveName?: string
): Promise<BundleArchiveEntriesResult> {
  const resolvedAttachment = pickArchiveAttachment(messages, target);
  if (!resolvedAttachment.ok) return resolvedAttachment;

  const archiveEntries = await listArchiveEntries(resolvedAttachment.entry);
  if (!archiveEntries.length) {
    return { ok: false, error: '这个压缩包里没有可重新打包的文件。' };
  }

  const resolvedEntries = resolveArchiveEntriesForBundle(
    archiveEntries,
    entryTargets,
    entryPrefixes,
    excludeTargets,
    excludeEntryPrefixes
  );
  if (!resolvedEntries.ok) return resolvedEntries;

  const zip = await loadArchive(resolvedAttachment.entry);
  const { default: JSZip } = await import('jszip');
  const nextZip = new JSZip();
  const bundledEntries: ArchiveEntryRef[] = [];

  for (const archiveEntry of resolvedEntries.entries) {
    const zipEntry = zip.file(archiveEntry.path);
    if (!zipEntry) continue;
    nextZip.file(archiveEntry.path, await zipEntry.async('uint8array'));
    bundledEntries.push(archiveEntry);
  }

  if (!bundledEntries.length) {
    return { ok: false, error: '选中的包内文件没有可重新打包的数据。' };
  }

  const bytes = await nextZip.generateAsync({ type: 'uint8array' });
  const baseName = resolvedAttachment.entry.name.replace(/\.zip$/i, '');
  const finalArchiveName = normalizeArchiveName(archiveName || `${baseName}-selected.zip`);
  const previewEntries = bundledEntries.slice(0, 6).map((entry) => entry.path);
  const extraCount = bundledEntries.length - previewEntries.length;

  return {
    ok: true,
    sourceAttachment: toAttachmentRef(resolvedAttachment.entry),
    attachment: await createStoredAttachment({
      kind: 'file',
      name: finalArchiveName,
      mimeType: 'application/zip',
      blob: new Blob([bytes as BlobPart], { type: 'application/zip' })
    }),
    entries: bundledEntries,
    detailText: [
      `来源压缩包：${resolvedAttachment.entry.name} · ${formatAttachmentSize(resolvedAttachment.entry.size)}`,
      `已重新打包 ${bundledEntries.length} 个包内文件，生成 ${finalArchiveName}`,
      ...previewEntries.map((entry, index) => `${index + 1}. ${entry}`),
      extraCount > 0 ? `…以及另外 ${extraCount} 个文件` : null
    ]
      .filter(Boolean)
      .join('\n')
  };
}
