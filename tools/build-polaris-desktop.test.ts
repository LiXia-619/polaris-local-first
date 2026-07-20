import { describe, expect, it } from 'vitest';
// The production build helper is intentionally a directly executable ESM script.
// @ts-expect-error It does not ship a separate TypeScript declaration file.
import { resolveNpmBuildInvocation } from './build-polaris-desktop.mjs';

describe('resolveNpmBuildInvocation', () => {
  it('runs the active npm JavaScript entry through Node on Windows', () => {
    expect(resolveNpmBuildInvocation(
      { npm_execpath: 'C:\\node\\npm-cli.js' },
      'win32',
      'C:\\node\\node.exe'
    )).toEqual({
      command: 'C:\\node\\node.exe',
      args: ['C:\\node\\npm-cli.js', 'run', 'build']
    });
  });

  it('uses cmd.exe only as a Windows fallback when npm_execpath is unavailable', () => {
    expect(resolveNpmBuildInvocation(
      { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
      'win32',
      'C:\\node\\node.exe'
    )).toEqual({
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd run build']
    });
  });

  it('uses npm directly on non-Windows platforms without npm_execpath', () => {
    expect(resolveNpmBuildInvocation({}, 'linux', '/usr/bin/node')).toEqual({
      command: 'npm',
      args: ['run', 'build']
    });
  });
});
