import { describe, expect, it } from 'vitest';
import {
  resolveAttachmentTargetEntry,
  resolveReadableTargetEntry,
  type AttachmentEntry
} from './attachmentToolEntries';

function createEntry(seed: Partial<AttachmentEntry> & Pick<AttachmentEntry, 'id' | 'name'>): AttachmentEntry {
  return {
    id: seed.id,
    kind: seed.kind ?? 'file',
    name: seed.name,
    mimeType: seed.mimeType ?? 'application/zip',
    size: seed.size ?? 1,
    hasText: seed.hasText ?? true,
    sourceLabel: seed.sourceLabel ?? '用户消息',
    messageId: seed.messageId ?? 'message',
    role: seed.role ?? 'user',
    attachmentIndex: seed.attachmentIndex ?? 0,
    attachment: seed.attachment ?? {
      id: seed.id,
      kind: seed.kind ?? 'file',
      name: seed.name,
      mimeType: seed.mimeType ?? 'application/zip',
      size: seed.size ?? 1,
      assetId: `asset-${seed.id}`,
      textContent: seed.hasText === false ? undefined : 'content'
    }
  };
}

describe('attachmentToolEntries', () => {
  it('prefers the latest exact-name attachment match instead of failing on duplicates', () => {
    const result = resolveAttachmentTargetEntry([
      createEntry({ id: 'zip-old', name: 'snapshot.zip', messageId: 'old' }),
      createEntry({ id: 'zip-new', name: 'snapshot.zip', messageId: 'new' })
    ], 'snapshot.zip', {
      noun: 'zip 附件',
      kind: 'file',
      matcher: (entry) => entry.mimeType.includes('zip')
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.id).toBe('zip-new');
    }
  });

  it('still prefers an exact id match when target is an attachment id', () => {
    const result = resolveAttachmentTargetEntry([
      createEntry({ id: 'zip-old', name: 'snapshot.zip' }),
      createEntry({ id: 'zip-new', name: 'snapshot.zip' })
    ], 'zip-old', {
      noun: 'zip 附件',
      kind: 'file',
      matcher: (entry) => entry.mimeType.includes('zip')
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.id).toBe('zip-old');
    }
  });

  it('prefers the latest exact-name readable attachment match too', () => {
    const result = resolveReadableTargetEntry([
      createEntry({ id: 'txt-old', name: 'notes.ts', mimeType: 'text/plain' }),
      createEntry({ id: 'txt-new', name: 'notes.ts', mimeType: 'text/plain' })
    ], 'notes.ts');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.id).toBe('txt-new');
    }
  });
});
