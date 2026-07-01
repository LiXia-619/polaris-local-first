const fs = require('node:fs');
const path = require('node:path');

function normalizeDesktopRelativePath(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\/+/, '')
    .replace(/\/{2,}/g, '/');
}

function isPathInsideRoot(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function findNearestExistingPath(targetPath) {
  let currentPath = targetPath;
  while (!fs.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return currentPath;
    }
    currentPath = parentPath;
  }
  return currentPath;
}

function resolveRealPath(targetPath) {
  return fs.realpathSync.native
    ? fs.realpathSync.native(targetPath)
    : fs.realpathSync(targetPath);
}

function resolveDesktopLocalPath(rootPath, relativePath = '', options = {}) {
  const cleanRelativePath = normalizeDesktopRelativePath(relativePath);
  const resolvedRootPath = path.resolve(rootPath);
  const targetPath = path.resolve(resolvedRootPath, cleanRelativePath || '.');
  const targetMustExist = options.targetMustExist !== false;

  if (!isPathInsideRoot(resolvedRootPath, targetPath)) {
    throw new Error('路径越出了已授权的本地工作区。');
  }

  const realRootPath = resolveRealPath(resolvedRootPath);
  const realBoundaryPath = resolveRealPath(
    targetMustExist ? targetPath : findNearestExistingPath(targetPath)
  );

  if (!isPathInsideRoot(realRootPath, realBoundaryPath)) {
    throw new Error('路径越出了已授权的本地工作区。');
  }

  return {
    targetPath,
    cleanRelativePath,
    realRootPath,
    realBoundaryPath
  };
}

function resolveDesktopLocalWritablePath(rootPath, relativePath = '') {
  return resolveDesktopLocalPath(rootPath, relativePath, { targetMustExist: false });
}

module.exports = {
  normalizeDesktopRelativePath,
  resolveDesktopLocalPath,
  resolveDesktopLocalWritablePath
};
