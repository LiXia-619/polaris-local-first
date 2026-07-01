import { formatAttachmentSize } from './attachmentFormat';
import type { ChatAttachment, ChatMessage } from '../types/domain';

export type ToolAttachmentRef = {
  id: string;
  kind: ChatAttachment['kind'];
  name: string;
  mimeType: string;
  size: number;
  hasText: boolean;
  sourceLabel: string;
};

export type AttachmentEntry = ToolAttachmentRef & {
  attachment: ChatAttachment;
  messageId: string;
  role: ChatMessage['role'];
  attachmentIndex: number;
};

function normalizeTarget(value: string) {
  return value.trim().toLowerCase().replace(/[《》"'“”‘’]/g, '');
}

function pickLatestAttachmentMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => (message.attachments?.length ?? 0) > 0) ?? null;
}

export function toAttachmentEntries(messages: ChatMessage[], scope: 'latest' | 'all' = 'all') {
  const scopedMessages =
    scope === 'latest'
      ? (pickLatestAttachmentMessage(messages) ? [pickLatestAttachmentMessage(messages) as ChatMessage] : [])
      : messages.filter((message) => (message.attachments?.length ?? 0) > 0);

  return scopedMessages.flatMap((message) =>
    (message.attachments ?? [])
      .map((attachment, attachmentIndex) => ({ attachment, attachmentIndex }))
      .filter(({ attachment }) => !attachment.clearedAt)
      .map(({ attachment, attachmentIndex }) => ({
      id: attachment.id,
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      hasText: Boolean(attachment.textContent?.trim()),
      messageId: message.id,
      role: message.role,
      attachmentIndex,
      sourceLabel:
        scope === 'latest'
          ? '最近一条带附件的消息'
          : message.role === 'user'
            ? '用户消息'
            : message.role === 'assistant'
              ? '助手消息'
              : '系统消息',
      attachment
    }))
  );
}

export function filterAttachmentEntries(entries: AttachmentEntry[], query?: string) {
  if (!query?.trim()) return entries;
  const normalized = normalizeTarget(query);
  return entries.filter((entry) => {
    const id = normalizeTarget(entry.id);
    const name = normalizeTarget(entry.name);
    return id === normalized || name === normalized || name.includes(normalized);
  });
}

function resolvePreferredAttachmentMatch(entries: AttachmentEntry[], target: string) {
  const normalized = normalizeTarget(target);
  const exactIdMatches = entries.filter((entry) => normalizeTarget(entry.id) === normalized);
  if (exactIdMatches.length === 1) return exactIdMatches[0];

  const exactNameMatches = entries.filter((entry) => normalizeTarget(entry.name) === normalized);
  if (exactNameMatches.length > 0) return exactNameMatches[exactNameMatches.length - 1];

  return null;
}

export function resolveReadableTargetEntry(entries: AttachmentEntry[], target?: string) {
  const textEntries = entries.filter((entry) => entry.hasText);
  if (!textEntries.length) {
    return { ok: false as const, error: '当前没有可读取的文本附件。' };
  }
  if (!target?.trim()) {
    if (textEntries.length === 1) return { ok: true as const, entry: textEntries[0] };
    return {
      ok: false as const,
      error: `可读附件不止一个，请指定 target。当前有：${textEntries.map((entry) => entry.name).join('、')}`
    };
  }

  const matches = filterAttachmentEntries(textEntries, target);
  const preferredMatch = resolvePreferredAttachmentMatch(matches, target);
  if (preferredMatch) return { ok: true as const, entry: preferredMatch };
  if (matches.length === 1) return { ok: true as const, entry: matches[0] };
  if (matches.length > 1) {
    return {
      ok: false as const,
      error: `“${target}”匹配到多个附件：${matches.map((entry) => entry.name).join('、')}`
    };
  }
  return { ok: false as const, error: `没有找到名为“${target}”的可读附件。` };
}

type ResolveAttachmentTargetOptions = {
  kind?: ChatAttachment['kind'];
  hasText?: boolean;
  noun: string;
  matcher?: (entry: AttachmentEntry) => boolean;
};

export function resolveAttachmentTargetEntry(
  entries: AttachmentEntry[],
  target: string | undefined,
  options: ResolveAttachmentTargetOptions
) {
  const matchedEntries = entries.filter((entry) => {
    if (options.kind && entry.kind !== options.kind) return false;
    if (options.hasText && !entry.hasText) return false;
    if (options.matcher && !options.matcher(entry)) return false;
    return true;
  });

  if (!matchedEntries.length) {
    return { ok: false as const, error: `当前没有可保存的${options.noun}。` };
  }

  if (!target?.trim()) {
    if (matchedEntries.length === 1) {
      return { ok: true as const, entry: matchedEntries[0] };
    }
    return {
      ok: false as const,
      error: `可用${options.noun}不止一个，请指定 target。当前有：${matchedEntries.map((entry) => entry.name).join('、')}`
    };
  }

  const filtered = filterAttachmentEntries(matchedEntries, target);
  const preferredMatch = resolvePreferredAttachmentMatch(filtered, target);
  if (preferredMatch) return { ok: true as const, entry: preferredMatch };
  if (filtered.length === 1) return { ok: true as const, entry: filtered[0] };
  if (filtered.length > 1) {
    return {
      ok: false as const,
      error: `“${target}”匹配到多个${options.noun}：${filtered.map((entry) => entry.name).join('、')}`
    };
  }

  return {
    ok: false as const,
    error: `没有找到名为“${target}”的${options.noun}。`
  };
}
