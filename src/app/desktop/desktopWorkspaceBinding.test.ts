import { describe, expect, it } from 'vitest';
import {
  buildDesktopWorkspaceBinding,
  buildDesktopWorkspaceFileSyncMap,
  buildDesktopWorkspaceManifestContent,
  buildDesktopWorkspaceStarterEntry,
  chooseDesktopWorkspaceEntryPath,
  createDesktopWorkspaceContentHash,
  createDesktopWorkspaceFileSyncEntry,
  DESKTOP_WORKSPACE_MANIFEST_PATH,
  planDesktopWorkspaceDiskImport,
  planDesktopWorkspaceDiskWrite,
  parseDesktopWorkspaceManifest
} from './desktopWorkspaceBinding';
import type { DesktopLocalDirectoryEntry, DesktopLocalWorkspaceFileSnapshot, DesktopTrustedRoot } from '../../desktop/localHost';
import type { ProjectFile } from '../../types/domain';

function file(name: string): DesktopLocalDirectoryEntry {
  return { name, kind: 'file' };
}

function diskFile(relativePath: string, content: string, updatedAt = 20): DesktopLocalWorkspaceFileSnapshot {
  return {
    relativePath,
    content,
    bytes: content.length,
    updatedAt
  };
}

function projectFile(filePath: string, content: string, updatedAt = 20): ProjectFile {
  return {
    id: `file-${filePath}`,
    projectId: 'project-1',
    filePath,
    language: 'text',
    content,
    source: 'manual',
    createdAt: 1,
    updatedAt
  };
}

const root: DesktopTrustedRoot = {
  id: 'root-1',
  label: 'Demo',
  path: '/Users/aa/Demo',
  createdAt: 1,
  lastUsedAt: null
};

describe('desktopWorkspaceBinding', () => {
  it('keeps the Polaris manifest separate from the user entry file', () => {
    const content = buildDesktopWorkspaceManifestContent({
      projectId: 'project-1',
      title: 'Demo',
      entryFilePath: 'src/main.ts'
    });

    expect(parseDesktopWorkspaceManifest(content)).toMatchObject({
      projectId: 'project-1',
      title: 'Demo',
      entryFilePath: 'src/main.ts'
    });
  });

  it('rejects manifests that point at Polaris metadata as the entry', () => {
    const content = buildDesktopWorkspaceManifestContent({
      projectId: 'project-1',
      title: 'Demo',
      entryFilePath: DESKTOP_WORKSPACE_MANIFEST_PATH
    });

    expect(parseDesktopWorkspaceManifest(content)?.entryFilePath).toBe('index.html');
  });

  it('prefers existing conventional entry files before creating a default entry path', () => {
    const entries = [file('package.json'), file('index.html'), file('README.md')];

    expect(chooseDesktopWorkspaceEntryPath({ entries })).toBe('index.html');
  });

  it('uses the manifest entry when a folder already has one', () => {
    const manifest = parseDesktopWorkspaceManifest(buildDesktopWorkspaceManifestContent({
      projectId: 'project-1',
      title: 'Demo',
      entryFilePath: 'src/main.ts'
    }));

    expect(chooseDesktopWorkspaceEntryPath({ entries: [file('index.html')], manifest })).toBe('src/main.ts');
  });

  it('stores host identity without copying the absolute folder path into the project binding', () => {
    const binding = buildDesktopWorkspaceBinding({
      root,
      entryFilePath: 'index.html',
      at: 10
    });

    expect(binding).toEqual({
      rootId: 'root-1',
      rootLabel: 'Demo',
      manifestPath: DESKTOP_WORKSPACE_MANIFEST_PATH,
      entryFilePath: 'index.html',
      linkedAt: 10,
      syncedAt: 10
    });
  });

  it('escapes the generated starter entry title', () => {
    expect(buildDesktopWorkspaceStarterEntry('<Demo>')).toContain('&lt;Demo&gt;');
  });

  it('creates deterministic content hashes for sync checks', () => {
    expect(createDesktopWorkspaceContentHash('hello')).toBe(createDesktopWorkspaceContentHash('hello'));
    expect(createDesktopWorkspaceContentHash('hello')).not.toBe(createDesktopWorkspaceContentHash('hello!'));
  });

  it('marks same-path import conflicts when both disk and Polaris changed since the last sync', () => {
    const syncEntry = createDesktopWorkspaceFileSyncEntry({
      relativePath: 'index.html',
      diskContent: 'old',
      polarisContent: 'old',
      diskUpdatedAt: 10,
      polarisUpdatedAt: 10,
      syncedAt: 10
    });

    const plan = planDesktopWorkspaceDiskImport({
      diskFiles: [diskFile('index.html', 'disk-new', 30)],
      projectFiles: [projectFile('index.html', 'polaris-new', 40)],
      fileSync: buildDesktopWorkspaceFileSyncMap(syncEntry ? [syncEntry] : [])
    });

    expect(plan.changedFiles).toEqual(['index.html']);
    expect(plan.issues).toEqual([{ path: 'index.html', kind: 'conflict' }]);
  });

  it('marks untracked write collisions before overwriting disk files', () => {
    const plan = planDesktopWorkspaceDiskWrite({
      diskFiles: [diskFile('index.html', 'disk-only', 30)],
      projectFiles: [projectFile('index.html', 'polaris-only', 40)]
    });

    expect(plan.changedFiles).toEqual(['index.html']);
    expect(plan.issues).toEqual([{ path: 'index.html', kind: 'conflict' }]);
  });
});
