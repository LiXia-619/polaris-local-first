import { inferCodeLanguage } from '../../engines/codeCardLanguage';
import { normalizeCodeCardFilePath } from '../../engines/roomProjects';
import type { DesktopLocalDirectoryEntry, DesktopLocalWorkspaceFileSnapshot, DesktopTrustedRoot } from '../../desktop/localHost';
import type { DesktopWorkspaceBinding, DesktopWorkspaceFileSyncEntry, ProjectFile } from '../../types/domain';

export const DESKTOP_WORKSPACE_MANIFEST_PATH = '.polaris/workspace.json';
export const DESKTOP_WORKSPACE_MANIFEST_KIND = 'polaris.desktop.workspace';

export type DesktopWorkspaceManifest = {
  kind: typeof DESKTOP_WORKSPACE_MANIFEST_KIND;
  version: 1;
  projectId: string;
  title: string;
  entryFilePath: string;
  updatedAt: number;
};

const PREFERRED_ENTRY_PATHS = [
  'index.html',
  'app/page.html',
  'app/page.tsx',
  'src/main.tsx',
  'src/main.ts',
  'src/main.jsx',
  'src/main.js',
  'README.md',
  'readme.md',
  'package.json'
];

const TEXT_ENTRY_EXTENSIONS = new Set([
  'html',
  'htm',
  'tsx',
  'jsx',
  'ts',
  'js',
  'mjs',
  'cjs',
  'css',
  'json',
  'md',
  'txt',
  'yaml',
  'yml'
]);

const SYNC_HASH_SEED = 2166136261;

function normalizeManifestEntryPath(value: unknown) {
  const path = normalizeCodeCardFilePath(value);
  if (!path || path === DESKTOP_WORKSPACE_MANIFEST_PATH || path.startsWith('.polaris/')) {
    return null;
  }
  return path;
}

function isTextEntryFileName(value: string) {
  const extension = value.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_ENTRY_EXTENSIONS.has(extension);
}

export function parseDesktopWorkspaceManifest(content: string): DesktopWorkspaceManifest | null {
  try {
    const value = JSON.parse(content) as Partial<DesktopWorkspaceManifest>;
    const entryFilePath = normalizeManifestEntryPath(value.entryFilePath);
    if (
      value.kind !== DESKTOP_WORKSPACE_MANIFEST_KIND
      || value.version !== 1
      || typeof value.projectId !== 'string'
      || !value.projectId.trim()
      || typeof value.title !== 'string'
      || !value.title.trim()
      || !entryFilePath
    ) {
      return null;
    }
    return {
      kind: DESKTOP_WORKSPACE_MANIFEST_KIND,
      version: 1,
      projectId: value.projectId.trim(),
      title: value.title.trim(),
      entryFilePath,
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now()
    };
  } catch {
    return null;
  }
}

export function chooseDesktopWorkspaceEntryPath(args: {
  entries: DesktopLocalDirectoryEntry[];
  manifest?: DesktopWorkspaceManifest | null;
}) {
  if (args.manifest?.entryFilePath) {
    return args.manifest.entryFilePath;
  }

  const fileNames = args.entries
    .filter((entry) => entry.kind === 'file')
    .map((entry) => entry.name.trim())
    .filter(Boolean);
  const normalizedFileNames = new Set(
    fileNames
      .map((name) => normalizeCodeCardFilePath(name))
      .filter((name): name is string => Boolean(name))
  );
  const preferred = PREFERRED_ENTRY_PATHS.find((path) => normalizedFileNames.has(path));
  if (preferred) return preferred;
  const firstTextFile = fileNames.find(isTextEntryFileName);
  return normalizeCodeCardFilePath(firstTextFile) ?? 'index.html';
}

export function buildDesktopWorkspaceBinding(args: {
  root: DesktopTrustedRoot;
  entryFilePath: string;
  at?: number;
}): DesktopWorkspaceBinding {
  const at = args.at ?? Date.now();
  return {
    rootId: args.root.id,
    rootLabel: args.root.label,
    manifestPath: DESKTOP_WORKSPACE_MANIFEST_PATH,
    entryFilePath: normalizeManifestEntryPath(args.entryFilePath) ?? 'index.html',
    linkedAt: at,
    syncedAt: at
  };
}

export function createDesktopWorkspaceContentHash(content: string) {
  let hash = SYNC_HASH_SEED;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash.toString(16).padStart(8, '0');
}

export function createDesktopWorkspaceFileSyncEntry(args: {
  relativePath: string;
  diskContent: string;
  polarisContent: string;
  diskUpdatedAt: number;
  polarisUpdatedAt: number;
  syncedAt: number;
}): DesktopWorkspaceFileSyncEntry | null {
  const path = normalizeManifestEntryPath(args.relativePath);
  if (!path) return null;
  return {
    path,
    diskHash: createDesktopWorkspaceContentHash(args.diskContent),
    polarisHash: createDesktopWorkspaceContentHash(args.polarisContent),
    diskUpdatedAt: args.diskUpdatedAt,
    polarisUpdatedAt: args.polarisUpdatedAt,
    syncedAt: args.syncedAt
  };
}

export function buildDesktopWorkspaceFileSyncMap(entries: DesktopWorkspaceFileSyncEntry[]) {
  return Object.fromEntries(entries.map((entry) => [entry.path, entry]));
}

export type DesktopWorkspaceSyncPlanIssue = {
  path: string;
  kind: 'conflict' | 'overwrite';
};

export type DesktopWorkspaceDiskImportPlan = {
  changedFiles: string[];
  issues: DesktopWorkspaceSyncPlanIssue[];
};

export type DesktopWorkspaceDiskWritePlan = {
  changedFiles: string[];
  issues: DesktopWorkspaceSyncPlanIssue[];
};

export function planDesktopWorkspaceDiskImport(args: {
  diskFiles: DesktopLocalWorkspaceFileSnapshot[];
  projectFiles: ProjectFile[];
  fileSync?: DesktopWorkspaceBinding['fileSync'];
}): DesktopWorkspaceDiskImportPlan {
  const projectFileByPath = new Map(
    args.projectFiles.flatMap((file) => {
      const path = normalizeManifestEntryPath(file.filePath);
      return path ? [[path, file] as const] : [];
    })
  );
  const issues: DesktopWorkspaceSyncPlanIssue[] = [];
  const changedFiles: string[] = [];
  for (const diskFile of args.diskFiles) {
    const path = normalizeManifestEntryPath(diskFile.relativePath);
    if (!path) continue;
    const projectFile = projectFileByPath.get(path);
    if (!projectFile) {
      changedFiles.push(path);
      continue;
    }
    const diskHash = createDesktopWorkspaceContentHash(diskFile.content);
    const polarisHash = createDesktopWorkspaceContentHash(projectFile.content);
    if (diskHash === polarisHash) continue;
    changedFiles.push(path);
    const syncEntry = args.fileSync?.[path];
    const diskChangedSinceSync = syncEntry ? diskHash !== syncEntry.diskHash : false;
    const polarisChangedSinceSync = syncEntry ? polarisHash !== syncEntry.polarisHash : true;
    issues.push({
      path,
      kind: diskChangedSinceSync && polarisChangedSinceSync ? 'conflict' : 'overwrite'
    });
  }
  return { changedFiles, issues };
}

export function planDesktopWorkspaceDiskWrite(args: {
  diskFiles: DesktopLocalWorkspaceFileSnapshot[];
  projectFiles: ProjectFile[];
  fileSync?: DesktopWorkspaceBinding['fileSync'];
}): DesktopWorkspaceDiskWritePlan {
  const diskFileByPath = new Map(
    args.diskFiles.flatMap((file) => {
      const path = normalizeManifestEntryPath(file.relativePath);
      return path ? [[path, file] as const] : [];
    })
  );
  const issues: DesktopWorkspaceSyncPlanIssue[] = [];
  const changedFiles: string[] = [];
  for (const projectFile of args.projectFiles) {
    const path = normalizeManifestEntryPath(projectFile.filePath);
    if (!path) continue;
    const diskFile = diskFileByPath.get(path);
    if (!diskFile) {
      changedFiles.push(path);
      continue;
    }
    const diskHash = createDesktopWorkspaceContentHash(diskFile.content);
    const polarisHash = createDesktopWorkspaceContentHash(projectFile.content);
    if (diskHash === polarisHash) continue;
    changedFiles.push(path);
    const syncEntry = args.fileSync?.[path];
    const diskChangedSinceSync = syncEntry ? diskHash !== syncEntry.diskHash : true;
    const polarisChangedSinceSync = syncEntry ? polarisHash !== syncEntry.polarisHash : true;
    issues.push({
      path,
      kind: diskChangedSinceSync && polarisChangedSinceSync ? 'conflict' : 'overwrite'
    });
  }
  return { changedFiles, issues };
}

export function buildDesktopWorkspaceManifestContent(args: {
  projectId: string;
  title: string;
  entryFilePath: string;
  updatedAt?: number;
}) {
  const manifest: DesktopWorkspaceManifest = {
    kind: DESKTOP_WORKSPACE_MANIFEST_KIND,
    version: 1,
    projectId: args.projectId,
    title: args.title.trim() || '本机工作区',
    entryFilePath: normalizeManifestEntryPath(args.entryFilePath) ?? 'index.html',
    updatedAt: args.updatedAt ?? Date.now()
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildDesktopWorkspaceStarterEntry(title: string) {
  const displayTitle = title.trim() || 'Polaris 本机工作区';
  const safeTitle = escapeHtmlText(displayTitle);
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    `  <title>${safeTitle}</title>`,
    '</head>',
    '<body>',
    `  <main>${safeTitle}</main>`,
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

export function inferDesktopWorkspaceFileLanguage(filePath: string, content: string) {
  const extension = normalizeCodeCardFilePath(filePath)?.split('.').pop();
  return inferCodeLanguage(content, extension);
}
