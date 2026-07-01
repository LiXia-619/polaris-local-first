import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function readOptionValue(args, name) {
  const inlinePrefix = `${name}=`;
  const inlineValue = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inlineValue) return inlineValue.slice(inlinePrefix.length).trim();

  const optionIndex = args.indexOf(name);
  if (optionIndex >= 0) {
    return args[optionIndex + 1]?.trim() ?? '';
  }

  return '';
}

function validateApiOrigin(origin) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return 'Desktop API origin must be a valid absolute URL.';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Desktop API origin must use http or https.';
  }

  if (!parsed.host) {
    return 'Desktop API origin must include a host.';
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    return 'Desktop API origin must be an origin only, for example https://your-backend.example.com.';
  }

  return '';
}

export function resolveDesktopApiOrigin(args = process.argv.slice(2), env = process.env) {
  const explicitArg = readOptionValue(args, '--api-origin');
  const rawOrigin =
    explicitArg
    || env.POLARIS_DESKTOP_API_ORIGIN
    || env.VITE_POLARIS_API_ORIGIN
    || '';
  const origin = stripTrailingSlash((rawOrigin ?? '').trim());

  if (!origin) {
    return {
      ok: false,
      message: [
        'Desktop package builds need an explicit API origin.',
        'For a public/self-hosted build, run:',
        '  POLARIS_DESKTOP_API_ORIGIN=https://your-backend.example.com npm run desktop:package',
        'For a maintainer package, set POLARIS_DESKTOP_API_ORIGIN explicitly before packaging.'
      ].join('\n')
    };
  }

  const validationError = validateApiOrigin(origin);
  if (validationError) {
    return {
      ok: false,
      message: validationError
    };
  }

  return {
    ok: true,
    origin,
    source: explicitArg
      ? '--api-origin'
      : env.POLARIS_DESKTOP_API_ORIGIN
        ? 'POLARIS_DESKTOP_API_ORIGIN'
        : 'VITE_POLARIS_API_ORIGIN'
  };
}

function writeDesktopBuildMarker(root, resolved) {
  const markerPath = path.join(root, 'dist', 'desktop-api-origin.json');
  fs.writeFileSync(markerPath, `${JSON.stringify({
    apiOrigin: resolved.origin,
    source: resolved.source,
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`);
}

function main() {
  const root = process.cwd();
  const resolved = resolveDesktopApiOrigin();

  if (!resolved.ok) {
    console.error(resolved.message);
    process.exit(1);
  }

  console.log(`Building Polaris desktop frontend with API origin: ${resolved.origin}`);
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const build = spawnSync(npmCommand, ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_POLARIS_API_ORIGIN: resolved.origin
    }
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  writeDesktopBuildMarker(root, resolved);
  console.log('Desktop API origin marker written to dist/desktop-api-origin.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
