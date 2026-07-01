import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const args = process.argv.slice(2);

if (!args.length) {
  console.error('Usage: npm run source:search -- <rg-pattern-or-args>');
  process.exit(2);
}

const sourcePaths = [
  'src',
  'server',
  'api',
  'android/app/src',
  'android/app/build.gradle',
  'android/build.gradle',
  'android/settings.gradle',
  'android/variables.gradle',
  'ios/App/App/App.entitlements',
  'ios/App/App/AppDelegate.swift',
  'ios/App/App/Assets.xcassets',
  'ios/App/App/Base.lproj',
  'ios/App/App/Info.plist',
  'ios/App/App/PrivacyInfo.xcprivacy',
  'ios/App/CapApp-SPM/Sources',
  'ios/App/CapApp-SPM/Package.swift',
  'ios/App/App.xcodeproj/project.pbxproj',
  'public',
  'docs',
  'tools',
  'scripts',
  'README.md',
  'package.json',
  'vite.config.ts',
  'vitest.config.ts',
  'capacitor.config.ts',
  'tsconfig.json',
  'tsconfig.selfhost.json',
  'tsconfig.verify.json'
].filter((entry) => existsSync(path.join(root, entry)));

const generatedGlobs = [
  '!dist/**',
  '!server-dist/**',
  '!desktop-dist/**',
  '!exports/**',
  '!output/**',
  '!tmp/**',
  '!android/.gradle/**',
  '!android/build/**',
  '!android/app/build/**',
  '!android/app/src/main/assets/**',
  '!android/capacitor-cordova-android-plugins/**',
  '!ios/build/**',
  '!ios/App/build/**',
  '!ios/App/App/public/**',
  '!ios/App/CapApp-SPM/.build/**',
  '!ios/App/CapApp-SPM/.swiftpm/**',
  '!ios/capacitor-cordova-ios-plugins/**'
];

const rgArgs = [
  '--line-number',
  '--hidden',
  '--glob',
  '!**/.DS_Store',
  ...generatedGlobs.flatMap((glob) => ['--glob', glob]),
  ...args,
  ...sourcePaths
];

const result = spawnSync('rg', rgArgs, {
  cwd: root,
  stdio: 'inherit'
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
