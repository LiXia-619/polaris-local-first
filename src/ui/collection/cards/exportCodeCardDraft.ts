import { canUseNativeSystemBackupFiles, exportFileViaSystemFiles } from '../../../native/systemBackupFiles';
import type { I18nTranslator } from '../../../i18n';

const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
  css: 'css',
  html: 'html',
  javascript: 'js',
  js: 'js',
  json: 'json',
  markdown: 'md',
  md: 'md',
  plaintext: 'txt',
  text: 'txt',
  ts: 'ts',
  tsx: 'tsx',
  typescript: 'ts',
  jsx: 'jsx'
};

const LANGUAGE_MIME_TYPE_MAP: Record<string, string> = {
  css: 'text/css;charset=utf-8',
  html: 'text/html;charset=utf-8',
  javascript: 'text/javascript;charset=utf-8',
  js: 'text/javascript;charset=utf-8',
  json: 'application/json;charset=utf-8',
  markdown: 'text/markdown;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  plaintext: 'text/plain;charset=utf-8',
  text: 'text/plain;charset=utf-8',
  ts: 'text/typescript;charset=utf-8',
  tsx: 'text/tsx;charset=utf-8',
  typescript: 'text/typescript;charset=utf-8',
  jsx: 'text/jsx;charset=utf-8'
};

function sanitizeFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveExtension(language: string) {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return 'txt';
  return LANGUAGE_EXTENSION_MAP[normalized] ?? (normalized.replace(/[^a-z0-9]+/g, '') || 'txt');
}

function resolveMimeType(language: string) {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return 'text/plain;charset=utf-8';
  return LANGUAGE_MIME_TYPE_MAP[normalized] ?? 'text/plain;charset=utf-8';
}

export function resolveCodeCardExportFileName(title: string, language: string) {
  const safeTitle = sanitizeFileNamePart(title) || 'polaris-card';
  const extension = resolveExtension(language);
  return safeTitle.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
    ? safeTitle
    : `${safeTitle}.${extension}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

export async function exportCodeCardDraft(
  title: string,
  language: string,
  code: string,
  copy?: Pick<I18nTranslator, 't'>
) {
  try {
    const fileName = resolveCodeCardExportFileName(title, language);
    const blob = new Blob([code], { type: resolveMimeType(language) });

    if (canUseNativeSystemBackupFiles()) {
      return await exportFileViaSystemFiles(blob, fileName);
    }

    downloadBlob(blob, fileName);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : copy?.t('collection.workshop.exportFailed') ?? '导出文件失败。';
    window.alert(message);
    return false;
  }
}
