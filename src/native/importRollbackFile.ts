import { Capacitor, registerPlugin } from '@capacitor/core';
import { bytesToBase64, base64ToBytes } from './nativeBase64';
import { dbStoreDelete, dbStoreGet, dbStoreSet, IMPORT_ROLLBACK_STORE } from '../infrastructure/persistence';

type NativeRollbackReadResult =
  | { exists: false }
  | { exists: true; fileUrl?: string; dataBase64?: string; mimeType?: string; size?: number };

type NativeRollbackFinishResult = {
  size?: number;
};

export type ImportRollbackFileStatus =
  | { exists: false }
  | {
      exists: true;
      size: number | null;
      storage: 'native' | 'opfs' | 'persisted';
      canReadWithoutMaterializing: boolean;
    };

type SystemFileRollbackPlugin = {
  beginImportRollbackFile?: () => Promise<void>;
  appendImportRollbackFileChunk?: (options: { dataBase64: string }) => Promise<void>;
  finishImportRollbackFile?: (options: { expectedByteLength?: number }) => Promise<NativeRollbackFinishResult>;
  readImportRollbackFile?: () => Promise<NativeRollbackReadResult>;
  clearImportRollbackFile?: () => Promise<void>;
};

type FileSystemWritableFileStreamLike = {
  write: (data: Blob | BufferSource | string) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandleLike = {
  createWritable?: () => Promise<FileSystemWritableFileStreamLike>;
  getFile: () => Promise<File>;
};

type FileSystemDirectoryHandleLike = {
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemFileHandleLike>;
  removeEntry: (name: string) => Promise<void>;
};

type StorageManagerWithOpfs = StorageManager & {
  getDirectory?: () => Promise<FileSystemDirectoryHandleLike>;
};

const SystemFileRollback = registerPlugin<SystemFileRollbackPlugin>('SystemFile');
const IMPORT_ROLLBACK_FILE_NAME = 'polaris-import-rollback.zip';
const NATIVE_ROLLBACK_CHUNK_BYTES = 512 * 1024;

function isNativeRollbackAvailable() {
  return Capacitor.isNativePlatform()
    && (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android')
    && typeof SystemFileRollback.beginImportRollbackFile === 'function'
    && typeof SystemFileRollback.appendImportRollbackFileChunk === 'function'
    && typeof SystemFileRollback.finishImportRollbackFile === 'function'
    && typeof SystemFileRollback.readImportRollbackFile === 'function'
    && typeof SystemFileRollback.clearImportRollbackFile === 'function';
}

function getOpfsRoot(): Promise<FileSystemDirectoryHandleLike> | null {
  if (Capacitor.isNativePlatform() || typeof navigator === 'undefined') return null;
  const storage = navigator.storage as StorageManagerWithOpfs | undefined;
  return storage?.getDirectory ? storage.getDirectory() : null;
}

async function readOpfsRollbackFile(): Promise<File | null> {
  const rootPromise = getOpfsRoot();
  if (!rootPromise) return null;
  try {
    const root = await rootPromise;
    const file = await root.getFileHandle(IMPORT_ROLLBACK_FILE_NAME);
    return await file.getFile();
  } catch {
    return null;
  }
}

async function peekOpfsRollbackFileStatus(): Promise<ImportRollbackFileStatus> {
  const file = await readOpfsRollbackFile();
  if (!file) return { exists: false };
  return {
    exists: true,
    size: file.size,
    storage: 'opfs',
    canReadWithoutMaterializing: true
  };
}

async function clearOpfsRollbackFile() {
  const rootPromise = getOpfsRoot();
  if (!rootPromise) return;
  try {
    const root = await rootPromise;
    await root.removeEntry(IMPORT_ROLLBACK_FILE_NAME);
  } catch {
    // Missing rollback files are already clear.
  }
}

async function writeOpfsRollbackFile(blob: Blob) {
  const rootPromise = getOpfsRoot();
  if (!rootPromise) return false;
  const root = await rootPromise;
  const file = await root.getFileHandle(IMPORT_ROLLBACK_FILE_NAME, { create: true });
  if (typeof file.createWritable !== 'function') {
    await clearOpfsRollbackFile();
    return false;
  }
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
  const written = await file.getFile();
  if (written.size !== blob.size) {
    await clearOpfsRollbackFile();
    return false;
  }
  return true;
}

async function readPersistedRollbackFile(): Promise<File | null> {
  const blob = await dbStoreGet<Blob>(IMPORT_ROLLBACK_STORE, IMPORT_ROLLBACK_FILE_NAME);
  if (!blob) return null;
  return new File([blob], IMPORT_ROLLBACK_FILE_NAME, {
    type: blob.type || 'application/zip'
  });
}

async function peekPersistedRollbackFileStatus(): Promise<ImportRollbackFileStatus> {
  const blob = await dbStoreGet<Blob>(IMPORT_ROLLBACK_STORE, IMPORT_ROLLBACK_FILE_NAME);
  if (!blob) return { exists: false };
  return {
    exists: true,
    size: blob.size,
    storage: 'persisted',
    canReadWithoutMaterializing: true
  };
}

async function writePersistedRollbackFile(blob: Blob) {
  await dbStoreSet(IMPORT_ROLLBACK_STORE, IMPORT_ROLLBACK_FILE_NAME, blob);
  const stored = await dbStoreGet<Blob>(IMPORT_ROLLBACK_STORE, IMPORT_ROLLBACK_FILE_NAME);
  if (!stored || stored.size !== blob.size) {
    await dbStoreDelete(IMPORT_ROLLBACK_STORE, IMPORT_ROLLBACK_FILE_NAME);
    return false;
  }
  return true;
}

async function clearPersistedRollbackFile() {
  await dbStoreDelete(IMPORT_ROLLBACK_STORE, IMPORT_ROLLBACK_FILE_NAME);
}

async function writeNativeRollbackFile(blob: Blob) {
  if (!isNativeRollbackAvailable()) return false;
  await SystemFileRollback.beginImportRollbackFile!();
  try {
    for (let offset = 0; offset < blob.size; offset += NATIVE_ROLLBACK_CHUNK_BYTES) {
      const chunk = new Uint8Array(
        await blob.slice(offset, Math.min(offset + NATIVE_ROLLBACK_CHUNK_BYTES, blob.size)).arrayBuffer()
      );
      await SystemFileRollback.appendImportRollbackFileChunk!({
        dataBase64: bytesToBase64(chunk)
      });
    }
    const result = await SystemFileRollback.finishImportRollbackFile!({
      expectedByteLength: blob.size
    });
    return typeof result.size !== 'number' || result.size === blob.size;
  } catch (error) {
    await SystemFileRollback.clearImportRollbackFile?.();
    throw error;
  }
}

async function readNativeRollbackFile(): Promise<File | null> {
  if (!isNativeRollbackAvailable()) return null;
  const result = await SystemFileRollback.readImportRollbackFile!();
  if (!result.exists) return null;
  if (result.fileUrl) {
    const response = await fetch(Capacitor.convertFileSrc(result.fileUrl));
    if (!response.ok) {
      throw new Error('读取导入回滚包失败。');
    }
    const blob = await response.blob();
    return new File([blob], IMPORT_ROLLBACK_FILE_NAME, {
      type: result.mimeType || blob.type || 'application/zip'
    });
  }
  if (result.dataBase64) {
    return new File([base64ToBytes(result.dataBase64)], IMPORT_ROLLBACK_FILE_NAME, {
      type: result.mimeType || 'application/zip'
    });
  }
  throw new Error('原生导入回滚包返回内容不完整。');
}

async function peekNativeRollbackFileStatus(): Promise<ImportRollbackFileStatus> {
  if (!isNativeRollbackAvailable()) return { exists: false };
  const result = await SystemFileRollback.readImportRollbackFile!();
  if (!result.exists) return { exists: false };
  const hasMetadataPath = Boolean(result.fileUrl) || typeof result.size === 'number';
  return {
    exists: true,
    size: typeof result.size === 'number'
      ? result.size
      : result.dataBase64
        ? Math.floor(result.dataBase64.length * 3 / 4)
        : null,
    storage: 'native',
    canReadWithoutMaterializing: hasMetadataPath
  };
}

export async function writeImportRollbackFile(blob: Blob) {
  if (isNativeRollbackAvailable()) {
    return await writeNativeRollbackFile(blob);
  }
  try {
    if (await writeOpfsRollbackFile(blob)) {
      return true;
    }
  } catch {
    await clearOpfsRollbackFile();
  }
  return await writePersistedRollbackFile(blob);
}

export async function readImportRollbackFile(): Promise<File | null> {
  if (isNativeRollbackAvailable()) {
    return await readNativeRollbackFile();
  }
  return await readOpfsRollbackFile() ?? await readPersistedRollbackFile();
}

export async function peekImportRollbackFileStatus(): Promise<ImportRollbackFileStatus> {
  if (isNativeRollbackAvailable()) {
    return await peekNativeRollbackFileStatus();
  }
  const opfsStatus = await peekOpfsRollbackFileStatus();
  if (opfsStatus.exists) return opfsStatus;
  return await peekPersistedRollbackFileStatus();
}

export async function clearImportRollbackFile() {
  if (isNativeRollbackAvailable()) {
    await SystemFileRollback.clearImportRollbackFile!();
    return;
  }
  await clearOpfsRollbackFile();
  await clearPersistedRollbackFile();
}
