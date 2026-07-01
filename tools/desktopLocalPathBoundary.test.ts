import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {
  normalizeDesktopRelativePath,
  resolveDesktopLocalPath,
  resolveDesktopLocalWritablePath
} = require('../desktop/electron/desktopLocalPathBoundary.cjs') as {
  normalizeDesktopRelativePath(value: unknown): string;
  resolveDesktopLocalPath(
    rootPath: string,
    relativePath?: string,
    options?: { targetMustExist?: boolean }
  ): { targetPath: string; cleanRelativePath: string; realRootPath: string; realBoundaryPath: string };
  resolveDesktopLocalWritablePath(
    rootPath: string,
    relativePath?: string
  ): { targetPath: string; cleanRelativePath: string; realRootPath: string; realBoundaryPath: string };
};

const tempRoots: string[] = [];

function createTempWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'polaris-desktop-path-'));
  tempRoots.push(dir);
  return dir;
}

function createSymlink(target: string, linkPath: string, type: fs.symlink.Type = 'file') {
  try {
    fs.symlinkSync(target, linkPath, type);
    return true;
  } catch {
    return false;
  }
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('desktop local path boundary', () => {
  it('normalizes desktop relative paths for host calls', () => {
    expect(normalizeDesktopRelativePath(' ./src//main.ts ')).toBe('src/main.ts');
    expect(normalizeDesktopRelativePath('\\src\\main.ts')).toBe('src/main.ts');
    expect(normalizeDesktopRelativePath('/src/main.ts')).toBe('src/main.ts');
    expect(normalizeDesktopRelativePath(null)).toBe('');
  });

  it('rejects lexical traversal outside the trusted root', () => {
    const root = createTempWorkspace();
    expect(() => resolveDesktopLocalPath(root, '../outside.txt')).toThrow('路径越出了已授权的本地工作区。');
  });

  it('allows new nested files under the trusted root', () => {
    const root = createTempWorkspace();
    const result = resolveDesktopLocalWritablePath(root, 'new/nested/file.txt');

    expect(result.targetPath).toBe(path.join(root, 'new', 'nested', 'file.txt'));
    expect(result.cleanRelativePath).toBe('new/nested/file.txt');
  });

  it('rejects symlink file reads that escape the trusted root', () => {
    const root = createTempWorkspace();
    const outside = createTempWorkspace();
    const outsideFile = path.join(outside, 'secret.txt');
    fs.writeFileSync(outsideFile, 'secret', 'utf-8');
    const linkPath = path.join(root, 'linked-secret.txt');
    if (!createSymlink(outsideFile, linkPath, 'file')) return;

    expect(() => resolveDesktopLocalPath(root, 'linked-secret.txt')).toThrow('路径越出了已授权的本地工作区。');
  });

  it('rejects writes through symlink directories that escape the trusted root', () => {
    const root = createTempWorkspace();
    const outside = createTempWorkspace();
    const linkPath = path.join(root, 'linked-outside');
    if (!createSymlink(outside, linkPath, 'dir')) return;

    expect(() =>
      resolveDesktopLocalWritablePath(root, 'linked-outside/file.txt')
    ).toThrow('路径越出了已授权的本地工作区。');
  });
});
