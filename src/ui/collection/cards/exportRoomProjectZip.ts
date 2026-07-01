import type { ResolvedRoomProjectFile } from '../../../engines/roomProjects';
import { normalizeCodeCardFilePath } from '../../../engines/roomProjects';
import { canUseNativeSystemBackupFiles, exportFileViaSystemFiles, getSystemBackupAvailability } from '../../../native/systemBackupFiles';
import type { RoomProject } from '../../../types/domain';

function sanitizeDownloadName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveArchiveRoot(project: RoomProject) {
  return sanitizeDownloadName(project.title) || sanitizeDownloadName(project.slug) || 'polaris-project';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

export async function exportRoomProjectZip(project: RoomProject, files: ResolvedRoomProjectFile[]) {
  if (files.length === 0) {
    throw new Error('这个工作区现在还没有可导出的文件。');
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const archiveRoot = resolveArchiveRoot(project);

  files.forEach((file) => {
    const filePath = normalizeCodeCardFilePath(file.path);
    if (!filePath) return;
    zip.file(`${archiveRoot}/${filePath}`, file.content);
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  const fileName = `${archiveRoot}.zip`;
  const availability = getSystemBackupAvailability();

  if (availability === 'unavailable') {
    throw new Error('当前平台不支持导出工作区 ZIP。');
  }

  if (canUseNativeSystemBackupFiles()) {
    return await exportFileViaSystemFiles(blob, fileName);
  }

  downloadBlob(blob, fileName);
  return true;
}
