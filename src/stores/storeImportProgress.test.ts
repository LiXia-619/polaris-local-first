import { describe, expect, it } from 'vitest';
import { formatStoreTransferProgress, resolveStoreTransferProgressPercent } from './storeImportProgress';

describe('store transfer progress helpers', () => {
  it('formats progress with a count when total is known', () => {
    expect(formatStoreTransferProgress({ message: '整理附件', current: 3, total: 10 })).toBe('整理附件 3/10');
  });

  it('formats stage-only progress without a count', () => {
    expect(formatStoreTransferProgress({ message: '读取对话和设置' })).toBe('读取对话和设置');
  });

  it('resolves a bounded percentage when total is known', () => {
    expect(resolveStoreTransferProgressPercent({ message: '压缩备份', current: 33.6, total: 100 })).toBe(34);
    expect(resolveStoreTransferProgressPercent({ message: '压缩备份', current: 120, total: 100 })).toBe(100);
  });

  it('returns null when progress has no measurable total', () => {
    expect(resolveStoreTransferProgressPercent({ message: '创建系统文件' })).toBeNull();
    expect(resolveStoreTransferProgressPercent(null)).toBeNull();
  });
});
