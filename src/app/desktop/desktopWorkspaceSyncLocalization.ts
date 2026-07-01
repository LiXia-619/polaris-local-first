import type { I18nTranslator } from '../../i18n';
import type {
  DesktopWorkspaceChangeStatus,
  DesktopWorkspaceSyncConfirmationRequest,
  DesktopWorkspaceSyncResult
} from './desktopWorkspaceSyncActions';

function formatSyncIssuePreview(paths: string[], t: I18nTranslator['t']) {
  const preview = paths.slice(0, 6).join('\n');
  return paths.length > 6
    ? t('settings.desktopLocal.syncIssuePreviewMore', { preview, count: paths.length - 6 })
    : preview;
}

export function buildLocalizedDesktopSyncConfirmationMessage(
  request: DesktopWorkspaceSyncConfirmationRequest,
  t: I18nTranslator['t']
) {
  if (request.changedFiles.length === 0) return null;
  const conflicts = request.issues.filter((issue) => issue.kind === 'conflict').map((issue) => issue.path);
  const overwrites = request.issues.filter((issue) => issue.kind === 'overwrite').map((issue) => issue.path);
  if (conflicts.length === 0 && overwrites.length === 0) return null;
  const action = request.direction === 'from-disk'
    ? t('settings.desktopLocal.syncFromDiskAction')
    : t('settings.desktopLocal.syncToDiskAction');
  const lines = [
    t('settings.desktopLocal.syncConfirmIntro', { action, count: request.changedFiles.length }),
    conflicts.length
      ? t('settings.desktopLocal.syncConfirmConflicts', { files: formatSyncIssuePreview(conflicts, t) })
      : '',
    overwrites.length
      ? t('settings.desktopLocal.syncConfirmOverwrites', { files: formatSyncIssuePreview(overwrites, t) })
      : '',
    t('settings.desktopLocal.syncConfirmContinue')
  ].filter(Boolean);
  return lines.join('\n\n');
}

export function describeLocalizedDesktopSyncResult(result: DesktopWorkspaceSyncResult, t: I18nTranslator['t']) {
  if (result.status === 'cancelled') {
    return result.direction === 'from-disk'
      ? t('settings.desktopLocal.syncCancelledFromDisk')
      : t('settings.desktopLocal.syncCancelledToDisk');
  }
  const action = result.direction === 'from-disk'
    ? t('settings.desktopLocal.syncedFromDisk')
    : t('settings.desktopLocal.syncedToDisk');
  return t('settings.desktopLocal.syncResult', {
    action,
    root: result.rootLabel,
    changed: result.changedFileCount,
    issues: result.issueCount
  });
}

export function describeLocalizedDesktopChangeStatus(status: DesktopWorkspaceChangeStatus, t: I18nTranslator['t']) {
  const diskCount = status.diskChangedFiles.length;
  const polarisCount = status.polarisChangedFiles.length;
  const conflictCount = status.conflictFiles.length;
  if (diskCount === 0 && polarisCount === 0) {
    return t('settings.desktopLocal.changeStatusClean');
  }
  if (conflictCount > 0) {
    return t('settings.desktopLocal.changeStatusConflicts', {
      conflicts: conflictCount,
      disk: diskCount,
      polaris: polarisCount
    });
  }
  if (diskCount > 0 && polarisCount > 0) {
    return t('settings.desktopLocal.changeStatusBothChanged', {
      disk: diskCount,
      polaris: polarisCount
    });
  }
  if (diskCount > 0) {
    return t('settings.desktopLocal.changeStatusDiskChanged', { count: diskCount });
  }
  return t('settings.desktopLocal.changeStatusPolarisChanged', { count: polarisCount });
}
