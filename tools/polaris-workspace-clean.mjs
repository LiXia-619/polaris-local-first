import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const includeTmp = args.has('--include-tmp');
const includeReleaseArtifacts = args.has('--include-release-artifacts');
const includeExports = args.has('--include-exports');

const defaultTargets = [
  'dist',
  'server-dist',
  'output',
  'tsconfig.tsbuildinfo',
  'android/build',
  'android/app/build',
  'android/app/src/main/assets/public',
  'android/capacitor-cordova-android-plugins',
  'ios/build',
  'ios/App/build',
  'ios/App/App/public',
  'ios/App/CapApp-SPM/.build',
  'ios/App/CapApp-SPM/.swiftpm',
  'ios/capacitor-cordova-ios-plugins'
];

const optionalTargets = [
  ...(includeTmp ? ['tmp'] : []),
  ...(includeReleaseArtifacts ? ['desktop-dist'] : []),
  ...(includeExports ? ['exports'] : [])
];

const targets = [...defaultTargets, ...optionalTargets];
const existing = [];

for (const target of targets) {
  const absolute = path.resolve(root, target);
  if (!absolute.startsWith(`${root}${path.sep}`) && absolute !== root) {
    throw new Error(`Refusing to inspect path outside repo: ${target}`);
  }
  try {
    const stats = await stat(absolute);
    existing.push({ target, absolute, kind: stats.isDirectory() ? 'dir' : 'file' });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (!existing.length) {
  console.log('No generated workspace artifacts found.');
  process.exit(0);
}

console.log(apply ? 'Removing generated workspace artifacts:' : 'Generated workspace artifacts that would be removed:');
for (const entry of existing) {
  console.log(`- ${entry.target}`);
}

if (!apply) {
  console.log('');
  console.log('Dry run only. Run `npm run workspace:clean:apply` to remove these generated files.');
  console.log('Optional: pass `-- --include-tmp`, `-- --include-release-artifacts`, or `-- --include-exports` when you intentionally want those included.');
  process.exit(0);
}

for (const entry of existing) {
  await rm(entry.absolute, { recursive: true, force: true });
}

console.log('Workspace generated artifacts removed.');
