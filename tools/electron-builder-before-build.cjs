const fs = require('node:fs');
const path = require('node:path');

module.exports = async function beforeBuild(context) {
  const appDir = context.appDir;
  const requiredFiles = [
    'package.json',
    path.join('dist', 'index.html'),
    path.join('dist', 'desktop-api-origin.json'),
    path.join('desktop', 'electron', 'main.cjs'),
    path.join('desktop', 'electron', 'preload.cjs')
  ];
  const missing = requiredFiles.filter((relativePath) => !fs.existsSync(path.join(appDir, relativePath)));

  if (missing.length > 0) {
    throw new Error(`Desktop staging is incomplete:\n${missing.join('\n')}`);
  }

  // The staged app deliberately has no production npm dependencies. Returning
  // false skips a needless native dependency rebuild inside electron-builder.
  return false;
};
