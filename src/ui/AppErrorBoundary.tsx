import { Component, type ErrorInfo, type ReactNode } from 'react';
import { readClientErrorLog, recordClientError, type ClientErrorLogEntry } from '../app/bootstrap/clientErrorLog';
import { writeTextToClipboard } from '../infrastructure/clipboard';
import { createTranslator, type I18nTranslator } from '../i18n';
import { useSpaceStore } from '../stores/spaceStore';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  latestError: ClientErrorLogEntry | null;
  copied: boolean;
  exportingBackup: boolean;
  backupStatus: string | null;
  backupError: string | null;
};

function createAppErrorTranslator() {
  return createTranslator(useSpaceStore.getState().appLanguage);
}

function fallbackErrorEntry(error: unknown): ClientErrorLogEntry {
  const { t } = createAppErrorTranslator();
  const message = error instanceof Error
    ? error.message || error.name
    : typeof error === 'string'
      ? error
      : t('app.error.unknown');
  return {
    id: 'err-pending',
    at: new Date().toISOString(),
    source: 'boundary',
    message
  };
}

function formatBackupExportError(error: unknown, t: I18nTranslator['t']) {
  const message = error instanceof Error ? error.message : '';
  if (/SystemFile/i.test(message) || /not implemented on ios/i.test(message)) {
    return t('app.error.backupIosUnavailable');
  }
  return message || t('app.error.backupExportFailed');
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    latestError: null,
    copied: false,
    exportingBackup: false,
    backupStatus: null,
    backupError: null
  };

  static getDerivedStateFromError(error: unknown): Partial<AppErrorBoundaryState> {
    return {
      latestError: fallbackErrorEntry(error)
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const entry = recordClientError(error, 'boundary', { componentStack: info.componentStack ?? undefined });
    this.setState({ latestError: entry, copied: false, backupError: null });
  }

  copyDiagnostics = async () => {
    const payload = JSON.stringify(readClientErrorLog().slice(0, 5), null, 2);
    try {
      await writeTextToClipboard(payload);
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  reload = () => {
    window.location.reload();
  };

  downloadFile = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  exportBackup = async () => {
    const { t } = createAppErrorTranslator();
    try {
      this.setState({
        exportingBackup: true,
        backupStatus: t('app.error.backupReading'),
        backupError: null,
        copied: false
      });
      const {
        exportPersistedCompleteBackup
      } = await import('../app/shell/persistedBackupExport');
      await exportPersistedCompleteBackup({
        downloadFile: this.downloadFile,
        onProgress: (progress) => {
          const suffix = typeof progress.current === 'number' && typeof progress.total === 'number'
            ? ` ${progress.current}/${progress.total}`
            : '';
          this.setState({ backupStatus: `${progress.message}${suffix}` });
        }
      });
      this.setState({ backupStatus: t('app.error.backupExported'), backupError: null });
    } catch (error) {
      this.setState({
        backupStatus: null,
        backupError: formatBackupExportError(error, t)
      });
    } finally {
      this.setState({ exportingBackup: false });
    }
  };

  render() {
    const { latestError, copied, exportingBackup, backupStatus, backupError } = this.state;
    const { t } = createAppErrorTranslator();
    if (!latestError) return this.props.children;

    return (
      <main className="app-error-boundary" role="alert">
        <section className="app-error-card">
          <small>{t('app.error.kicker')}</small>
          <h1>{t('app.error.title')}</h1>
          <p>{t('app.error.body')}</p>
          <div className="app-error-code">{latestError.id}</div>
          {backupStatus || backupError ? (
            <div className={`app-error-backup-status${backupError ? ' is-error' : ''}`}>
              {backupError ?? backupStatus}
            </div>
          ) : null}
          <div className="app-error-actions">
            <button type="button" onClick={this.exportBackup} disabled={exportingBackup}>
              {exportingBackup ? t('app.error.exportingBackup') : t('app.error.exportBackup')}
            </button>
            <button type="button" onClick={this.reload}>{t('app.error.reload')}</button>
            <button type="button" onClick={this.copyDiagnostics}>{copied ? t('app.error.copied') : t('app.error.copyDiagnostics')}</button>
          </div>
        </section>
      </main>
    );
  }
}
