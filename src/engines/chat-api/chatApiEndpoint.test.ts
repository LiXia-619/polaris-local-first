import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativePlatform = vi.hoisted(() => ({ value: false }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => nativePlatform.value
  }
}));

import { buildApiEndpoint, buildInternalApiEndpoint } from './chatApiEndpoint';

function setWindowOrigin(origin: string) {
  const protocol = new URL(origin).protocol;
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        origin,
        protocol
      }
    },
    configurable: true,
    writable: true
  });
}

function setDesktopWindowOrigin() {
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        origin: 'polaris://app',
        protocol: 'polaris:'
      }
    },
    configurable: true,
    writable: true
  });
}

describe('buildApiEndpoint', () => {
  beforeEach(() => {
    nativePlatform.value = false;
    vi.unstubAllEnvs();
    setWindowOrigin('https://polaris-two-topaz.vercel.app');
  });

  it('keeps localhost web origins for relative internal routes', () => {
    setWindowOrigin('http://localhost:5173');

    expect(buildApiEndpoint('/api', '/chat/completions')).toBe('http://localhost:5173/api/chat/completions');
  });

  it('keeps the stable Vercel production origin for relative internal routes', () => {
    setWindowOrigin('https://polaris-two-topaz.vercel.app');

    expect(buildApiEndpoint('/api', '/chat/completions')).toBe('https://polaris-two-topaz.vercel.app/api/chat/completions');
  });

  it('keeps the current preview Vercel origin for relative internal routes', () => {
    setWindowOrigin('https://polaris-git-fix-123-preview.vercel.app');

    expect(buildApiEndpoint('/api', '/chat/completions')).toBe('https://polaris-git-fix-123-preview.vercel.app/api/chat/completions');
  });

  it('keeps internal API routes relative when no web origin or env is available', () => {
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true
    });

    expect(buildInternalApiEndpoint('/api/health')).toBe('/api/health');
    expect(buildApiEndpoint('/api', '/chat/completions')).toBe('/api/chat/completions');
  });

  it('requires explicit internal API origin on native platforms', () => {
    nativePlatform.value = true;
    setWindowOrigin('https://polaris-git-fix-123-preview.vercel.app');

    expect(() => buildApiEndpoint('/api', '/chat/completions')).toThrow(
      '原生端内部 API 需要显式配置 `VITE_POLARIS_API_ORIGIN`'
    );
  });

  it('uses the configured internal API origin on native platforms', () => {
    nativePlatform.value = true;
    vi.stubEnv('VITE_POLARIS_API_ORIGIN', 'https://selfhost.example.test/');
    setWindowOrigin('https://polaris-git-fix-123-preview.vercel.app');

    expect(buildApiEndpoint('/api', '/chat/completions')).toBe('https://selfhost.example.test/api/chat/completions');
  });

  it('requires explicit internal API origin in the desktop custom scheme', () => {
    setDesktopWindowOrigin();

    expect(() => buildInternalApiEndpoint('/api/provider-relay')).toThrow(
      '桌面端内部 API 需要显式配置 `VITE_POLARIS_API_ORIGIN`'
    );
  });

  it('uses the configured internal API origin in the desktop custom scheme', () => {
    vi.stubEnv('VITE_POLARIS_API_ORIGIN', 'https://selfhost.example.test/');
    setDesktopWindowOrigin();

    expect(buildInternalApiEndpoint('/api/provider-relay')).toBe('https://selfhost.example.test/api/provider-relay');
    expect(buildApiEndpoint('/api', '/chat/completions')).toBe('https://selfhost.example.test/api/chat/completions');
  });
});
