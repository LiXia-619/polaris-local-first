import { canUseNativeSystemBackupFiles, exportFileViaSystemFiles } from '../../native/systemBackupFiles';

export type BrowserThemeFileDownload = (blob: Blob, fileName: string) => void;

export async function exportThemeFile(
  blob: Blob,
  fileName: string,
  browserDownload: BrowserThemeFileDownload
) {
  if (canUseNativeSystemBackupFiles()) {
    return await exportFileViaSystemFiles(blob, fileName);
  }

  browserDownload(blob, fileName);
  return true;
}
