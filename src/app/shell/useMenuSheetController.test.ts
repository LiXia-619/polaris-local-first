import { describe, expect, it } from 'vitest';
import {
  shouldBuildMenuTokenUsageSummary,
  shouldIncludeMenuRequestUsageReceipts,
  shouldRefreshMenuRuntimeLog,
  shouldRefreshMenuStorageHealth,
  shouldSyncMenuRequestEntries
} from './useMenuSheetController';

describe('menu sheet diagnostic timing', () => {
  it('keeps direct toolbox opens off the diagnostic read path', () => {
    expect(shouldSyncMenuRequestEntries(true, 'toolbox')).toBe(false);
    expect(shouldRefreshMenuStorageHealth(true, 'toolbox')).toBe(false);
    expect(shouldRefreshMenuRuntimeLog(true, 'toolbox')).toBe(false);
  });

  it('keeps the root usage teaser light without scanning messages or request diagnostics', () => {
    expect(shouldSyncMenuRequestEntries(true, 'root')).toBe(false);
    expect(shouldBuildMenuTokenUsageSummary(true, 'root')).toBe(false);
    expect(shouldIncludeMenuRequestUsageReceipts('root')).toBe(false);
    expect(shouldRefreshMenuStorageHealth(true, 'root')).toBe(false);
    expect(shouldRefreshMenuRuntimeLog(true, 'root')).toBe(false);
  });

  it('loads request-level usage receipts only on the usage page', () => {
    expect(shouldSyncMenuRequestEntries(true, 'usage')).toBe(true);
    expect(shouldBuildMenuTokenUsageSummary(true, 'usage')).toBe(true);
    expect(shouldIncludeMenuRequestUsageReceipts('usage')).toBe(true);
  });

  it('does not build token summaries for pages that do not render them', () => {
    expect(shouldBuildMenuTokenUsageSummary(true, 'toolbox')).toBe(false);
    expect(shouldBuildMenuTokenUsageSummary(true, 'storage')).toBe(false);
    expect(shouldBuildMenuTokenUsageSummary(false, 'usage')).toBe(false);
  });

  it('loads the full diagnostic bundle only on the storage page', () => {
    expect(shouldSyncMenuRequestEntries(true, 'storage')).toBe(true);
    expect(shouldRefreshMenuStorageHealth(true, 'storage')).toBe(true);
    expect(shouldRefreshMenuRuntimeLog(true, 'storage')).toBe(true);
  });

  it('does not refresh diagnostics while the menu is closed', () => {
    expect(shouldSyncMenuRequestEntries(false, 'root')).toBe(false);
    expect(shouldRefreshMenuStorageHealth(false, 'storage')).toBe(false);
    expect(shouldRefreshMenuRuntimeLog(false, 'storage')).toBe(false);
  });
});
