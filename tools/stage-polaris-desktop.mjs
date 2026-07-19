import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stagingDir = path.join(root, 'desktop-staging');
const sourceDist = path.join(root, 'dist');
const sourceDesktop = path.join(root, 'desktop');
const sourcePackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assertFile(path.join(sourceDist, 'index.html'), 'Run npm run desktop:build before staging.');
assertFile(
  path.join(sourceDist, 'desktop-api-origin.json'),
  'The desktop API origin marker is missing. Run npm run desktop:build with POLARIS_DESKTOP_API_ORIGIN set.'
);
assertFile(path.join(sourceDesktop, 'electron', 'main.cjs'), 'The Electron main process is missing.');

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

copyTree(sourceDist, path.join(stagingDir, 'dist'));
copyTree(sourceDesktop, path.join(stagingDir, 'desktop'));

const packagedPackage = {
  name: 'polaris-desktop',
  productName: 'Polaris',
  version: sourcePackage.version,
  private: true,
  main: 'desktop/electron/main.cjs'
};

fs.writeFileSync(
  path.join(stagingDir, 'package.json'),
  `${JSON.stringify(packagedPackage, null, 2)}\n`
);

const stagedFiles = [...walkFiles(stagingDir)];
const blockedFiles = stagedFiles.filter(isBlockedArtifact);

if (blockedFiles.length > 0) {
  throw new Error(`Desktop staging contains blocked artifacts:\n${blockedFiles.join('\n')}`);
}

console.log(`Desktop staging ready: ${stagedFiles.length} files in ${stagingDir}`);

function copyTree(source, target) {
  fs.cpSync(source, target, {
    recursive: true,
    filter: (entry) => !isBlockedArtifact(path.relative(root, entry))
  });
}

function assertFile(filePath, message) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(message);
  }
}

function isBlockedArtifact(relativePath) {
  const segments = relativePath.split(path.sep);
  const basename = segments.at(-1) ?? '';

  return segments.includes('node_modules')
    || basename === '.env'
    || basename.startsWith('.env.')
    || basename.endsWith('.map');
}

function* walkFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (entry.isFile()) {
      yield path.relative(stagingDir, fullPath);
    }
  }
}
