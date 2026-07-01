import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  nativePlatform: false,
  platform: 'web',
  persistedRollbackFiles: new Map<string, Blob>(),
  plugin: {
    beginImportRollbackFile: vi.fn(),
    appendImportRollbackFileChunk: vi.fn(),
    finishImportRollbackFile: vi.fn(),
    readImportRollbackFile: vi.fn(),
    clearImportRollbackFile: vi.fn()
  }
}));

vi.mock('../infrastructure/persistence', () => ({
  IMPORT_ROLLBACK_STORE: 'import-rollback',
  dbStoreGet: vi.fn(async (_storeName: string, key: string) => state.persistedRollbackFiles.get(key) ?? null),
  dbStoreSet: vi.fn(async (_storeName: string, key: string, value: Blob) => {
    state.persistedRollbackFiles.set(key, value);
  }),
  dbStoreDelete: vi.fn(async (_storeName: string, key: string) => {
    state.persistedRollbackFiles.delete(key);
  })
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => state.nativePlatform,
    getPlatform: () => state.platform,
    convertFileSrc: (fileUrl: string) => `converted:${fileUrl}`
  },
  registerPlugin: vi.fn(() => state.plugin)
}));

function createOpfsMock(options: { createWritable?: boolean } = { createWritable: true }) {
  const files = new Map<string, Blob>();
  const root = {
    getFileHandle: vi.fn(async (name: string, handleOptions?: { create?: boolean }) => {
      if (!files.has(name) && !handleOptions?.create) {
        throw new Error('not found');
      }
      return {
        createWritable: options.createWritable === false
          ? undefined
          : vi.fn(async () => {
              const chunks: BlobPart[] = [];
              return {
                write: vi.fn(async (data: BlobPart) => {
                  chunks.push(data);
                }),
                close: vi.fn(async () => {
                  files.set(name, new Blob(chunks, { type: 'application/zip' }));
                })
              };
            }),
        getFile: vi.fn(async () => new File([files.get(name) ?? new Blob()], name, {
          type: 'application/zip'
        }))
      };
    }),
    removeEntry: vi.fn(async (name: string) => {
      files.delete(name);
    })
  };
  return {
    files,
    getDirectory: vi.fn(async () => root)
  };
}

describe('import rollback file', () => {
  beforeEach(() => {
    state.nativePlatform = false;
    state.platform = 'web';
    state.persistedRollbackFiles.clear();
    Object.values(state.plugin).forEach((mock) => mock.mockReset());
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('uses OPFS only when writable handles can be read back', async () => {
    const opfs = createOpfsMock();
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: opfs.getDirectory
      }
    });
    const { readImportRollbackFile, writeImportRollbackFile } = await import('./importRollbackFile');

    await expect(writeImportRollbackFile(new Blob(['rollback'], {
      type: 'application/zip'
    }))).resolves.toBe(true);

    const file = await readImportRollbackFile();
    await expect(file?.text()).resolves.toBe('rollback');
  });

  it('falls back to persisted storage when OPFS writable handles are missing', async () => {
    const opfs = createOpfsMock({ createWritable: false });
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: opfs.getDirectory
      }
    });
    const { readImportRollbackFile, writeImportRollbackFile } = await import('./importRollbackFile');

    await expect(writeImportRollbackFile(new Blob(['rollback'], {
      type: 'application/zip'
    }))).resolves.toBe(true);

    const file = await readImportRollbackFile();
    await expect(file?.text()).resolves.toBe('rollback');
  });

  it('clears persisted fallback rollback files with OPFS files', async () => {
    const opfs = createOpfsMock({ createWritable: false });
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: opfs.getDirectory
      }
    });
    const { clearImportRollbackFile, readImportRollbackFile, writeImportRollbackFile } = await import('./importRollbackFile');

    await expect(writeImportRollbackFile(new Blob(['rollback']))).resolves.toBe(true);
    await clearImportRollbackFile();

    await expect(readImportRollbackFile()).resolves.toBeNull();
  });

  it('falls back to persisted storage when OPFS throws during write', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: vi.fn(async () => {
          throw new Error('OPFS unavailable');
        })
      }
    });
    const { readImportRollbackFile, writeImportRollbackFile } = await import('./importRollbackFile');

    await expect(writeImportRollbackFile(new Blob(['rollback']))).resolves.toBe(true);

    const file = await readImportRollbackFile();
    await expect(file?.text()).resolves.toBe('rollback');
  });

  it('streams native rollback files through the internal SystemFile bridge', async () => {
    state.nativePlatform = true;
    state.platform = 'ios';
    state.plugin.finishImportRollbackFile.mockResolvedValue({ size: 3 });
    const { writeImportRollbackFile } = await import('./importRollbackFile');

    await expect(writeImportRollbackFile(new Blob([new Uint8Array([1, 2, 3])], {
      type: 'application/zip'
    }))).resolves.toBe(true);

    expect(state.plugin.beginImportRollbackFile).toHaveBeenCalled();
    expect(state.plugin.appendImportRollbackFileChunk).toHaveBeenCalledWith({
      dataBase64: 'AQID'
    });
    expect(state.plugin.finishImportRollbackFile).toHaveBeenCalledWith({
      expectedByteLength: 3
    });
  });

  it('reads native rollback files by URL without bridge-sized base64', async () => {
    state.nativePlatform = true;
    state.platform = 'android';
    state.plugin.readImportRollbackFile.mockResolvedValue({
      exists: true,
      fileUrl: 'file:///tmp/polaris-import-rollback.zip',
      mimeType: 'application/zip'
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['rollback'], {
      type: 'application/zip'
    }))));
    const { readImportRollbackFile } = await import('./importRollbackFile');

    const file = await readImportRollbackFile();

    expect(fetch).toHaveBeenCalledWith('converted:file:///tmp/polaris-import-rollback.zip');
    await expect(file?.text()).resolves.toBe('rollback');
  });

  it('peeks native rollback metadata without fetching file bytes', async () => {
    state.nativePlatform = true;
    state.platform = 'ios';
    state.plugin.readImportRollbackFile.mockResolvedValue({
      exists: true,
      fileUrl: 'file:///tmp/polaris-import-rollback.zip',
      mimeType: 'application/zip',
      size: 1024
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { peekImportRollbackFileStatus } = await import('./importRollbackFile');

    await expect(peekImportRollbackFileStatus()).resolves.toEqual({
      exists: true,
      size: 1024,
      storage: 'native',
      canReadWithoutMaterializing: true
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('peeks persisted fallback rollback metadata without reading a file body', async () => {
    state.persistedRollbackFiles.set(
      'polaris-import-rollback.zip',
      new Blob(['rollback'], { type: 'application/zip' })
    );
    const { peekImportRollbackFileStatus } = await import('./importRollbackFile');

    await expect(peekImportRollbackFileStatus()).resolves.toEqual({
      exists: true,
      size: 8,
      storage: 'persisted',
      canReadWithoutMaterializing: true
    });
  });
});
