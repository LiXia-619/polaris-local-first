import { normalizeCodeLanguage } from '../../engines/codeCardEngine';
import { normalizeCodeCardFilePath } from '../../engines/roomProjects';
import type { CodeCardFileRole } from '../../types/domain';

function splitFilePath(path: string) {
  const normalized = normalizeCodeCardFilePath(path) ?? path.trim();
  const segments = normalized.split('/');
  const filename = segments.pop() ?? normalized;
  const extensionMatch = filename.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] ?? '';
  const stem = extension ? filename.slice(0, -extension.length) : filename;

  return {
    directory: segments.join('/'),
    stem: stem || 'untitled',
    extension
  };
}

export function buildNextWorkspaceTitle(existingTitles: string[], baseTitle = '新工作区') {
  const normalizedBase = baseTitle.trim() || '新工作区';
  const existing = new Set(existingTitles.map((title) => title.trim()).filter(Boolean));
  if (!existing.has(normalizedBase)) {
    return normalizedBase;
  }

  let index = 2;
  while (existing.has(`${normalizedBase} ${index}`)) {
    index += 1;
  }
  return `${normalizedBase} ${index}`;
}

export function buildNextWorkspaceFilePath(existingPaths: string[], preferredPath: string) {
  const normalizedPreferredPath = normalizeCodeCardFilePath(preferredPath) ?? preferredPath.trim();
  const existing = new Set(
    existingPaths
      .map((path) => normalizeCodeCardFilePath(path))
      .filter((path): path is string => Boolean(path))
  );
  if (!existing.has(normalizedPreferredPath)) {
    return normalizedPreferredPath;
  }

  const { directory, stem, extension } = splitFilePath(normalizedPreferredPath);
  let index = 2;
  while (true) {
    const nextFilename = `${stem}-${index}${extension}`;
    const nextPath = directory ? `${directory}/${nextFilename}` : nextFilename;
    if (!existing.has(nextPath)) {
      return nextPath;
    }
    index += 1;
  }
}

export function inferManualProjectFileRole(filePath: string, language: string): CodeCardFileRole {
  const normalizedPath = (normalizeCodeCardFilePath(filePath) ?? filePath.trim()).toLowerCase();
  const normalizedLanguage = normalizeCodeLanguage(language);

  if (
    normalizedPath === 'index.html'
    || normalizedPath.endsWith('/index.html')
    || normalizedPath === 'app/page.html'
    || normalizedPath.endsWith('/app/page.html')
    || normalizedLanguage === 'html'
    || normalizedLanguage === 'jsx'
    || normalizedLanguage === 'tsx'
  ) {
    return 'entry';
  }
  if (normalizedLanguage === 'css') {
    return 'style';
  }
  if (
    normalizedLanguage === 'javascript'
    || normalizedLanguage === 'typescript'
    || normalizedLanguage === 'jsx'
    || normalizedLanguage === 'tsx'
  ) {
    return 'logic';
  }
  return 'content';
}
