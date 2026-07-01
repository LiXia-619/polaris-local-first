import { afterEach, describe, expect, it, vi } from 'vitest';
import { importAllData } from './spaceStoreDataTransfer';

const importPackageMocks = vi.hoisted(() => ({
  importStructuredExportPackage: vi.fn()
}));

const kelivoImportMocks = vi.hoisted(() => ({
  importKelivoBackupPackageIfMatched: vi.fn()
}));

vi.mock('./storeImportPackage', () => importPackageMocks);

vi.mock('./kelivoImportAdapter', () => kelivoImportMocks);

afterEach(() => {
  vi.unstubAllGlobals();
  Object.values(importPackageMocks).forEach((mock) => mock.mockReset());
  Object.values(kelivoImportMocks).forEach((mock) => mock.mockReset());
});

describe('importAllData', () => {
  it('lets the Kelivo importer claim zip packages before structured Polaris import', async () => {
    kelivoImportMocks.importKelivoBackupPackageIfMatched.mockResolvedValue(true);
    const file = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], { type: 'application/zip' });

    await importAllData(file);

    expect(kelivoImportMocks.importKelivoBackupPackageIfMatched).toHaveBeenCalledWith(file, {});
    expect(importPackageMocks.importStructuredExportPackage).not.toHaveBeenCalled();
  });

  it('keeps non-Kelivo zip packages on the structured Polaris import path', async () => {
    kelivoImportMocks.importKelivoBackupPackageIfMatched.mockResolvedValue(false);
    importPackageMocks.importStructuredExportPackage.mockResolvedValue(undefined);
    const file = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], { type: 'application/zip' });

    await importAllData(file);

    expect(kelivoImportMocks.importKelivoBackupPackageIfMatched).toHaveBeenCalledWith(file, {});
    expect(importPackageMocks.importStructuredExportPackage).toHaveBeenCalledWith(file, {});
  });

  it('rejects non-zip backups instead of routing them through a legacy importer', async () => {
    const file = new Blob([JSON.stringify({ version: 1 })], { type: 'application/json' });

    await expect(importAllData(file)).rejects.toThrow('无法识别的备份格式');

    expect(kelivoImportMocks.importKelivoBackupPackageIfMatched).not.toHaveBeenCalled();
    expect(importPackageMocks.importStructuredExportPackage).not.toHaveBeenCalled();
  });
});
