export type StoreTransferProgress = {
  message: string;
  current?: number;
  total?: number;
};

export type StoreTransferProgressReporter = (progress: StoreTransferProgress) => void;

export type StoreImportProgress = StoreTransferProgress;
export type StoreImportProgressReporter = StoreTransferProgressReporter;

export function formatStoreTransferProgress(progress: StoreTransferProgress) {
  if (
    typeof progress.current === 'number'
    && typeof progress.total === 'number'
    && progress.total > 0
  ) {
    return `${progress.message} ${progress.current}/${progress.total}`;
  }
  return progress.message;
}

export function resolveStoreTransferProgressPercent(progress: StoreTransferProgress | null) {
  if (
    !progress
    || typeof progress.current !== 'number'
    || typeof progress.total !== 'number'
    || progress.total <= 0
  ) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)));
}

export const formatStoreImportProgress = formatStoreTransferProgress;
