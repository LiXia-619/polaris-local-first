import { describe, expect, it, vi } from 'vitest';

import {
  POLARIS_PUBLIC_PROVIDER,
  POLARIS_PUBLIC_PROVIDER_ID,
  POLARIS_PUBLIC_PROVIDER_KEY,
  getPolarisBuiltInProviderKind,
  getPolarisDeviceId,
  isPolarisBuiltInProvider,
  isPolarisPublicProvider,
  normalizePolarisPublicProvider
} from './freeProvider';

describe('freeProvider', () => {
  it('defaults the public built-in provider to Polaris', () => {
    expect(POLARIS_PUBLIC_PROVIDER.name).toBe('Polaris');
    expect(POLARIS_PUBLIC_PROVIDER.model).toBe('Polaris');
    expect(normalizePolarisPublicProvider().model).toBe('Polaris');
  });

  it('recognizes the built-in public provider by id and legacy sentinel route', () => {
    expect(isPolarisBuiltInProvider(POLARIS_PUBLIC_PROVIDER)).toBe(true);
    expect(isPolarisPublicProvider({
      id: POLARIS_PUBLIC_PROVIDER_ID,
      baseUrl: 'https://api.openai.com/v1',
      path: '/chat/completions',
      apiKey: ''
    })).toBe(true);
    expect(getPolarisBuiltInProviderKind({
      id: 'legacy',
      baseUrl: '/api',
      path: '/chat/completions',
      apiKey: 'polaris-free'
    })).toBe('public');
  });

  it('keeps only allowed public-provider models', () => {
    expect(normalizePolarisPublicProvider({
      model: 'Polaris'
    }).model).toBe('Polaris');
    expect(normalizePolarisPublicProvider({
      model: 'openai/gpt-oss-120b:free'
    }).model).toBe('openai/gpt-oss-120b:free');
    expect(normalizePolarisPublicProvider({
      model: 'openrouter/free'
    }).model).toBe('openrouter/free');
    expect(normalizePolarisPublicProvider({
      model: 'gpt-5'
    }).model).toBe(POLARIS_PUBLIC_PROVIDER.model);
  });

  it('persists the generated device id in localStorage', () => {
    const randomUUID = vi.fn(() => 'device-123');
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn()
      },
      crypto: {
        randomUUID
      }
    });

    expect(getPolarisDeviceId()).toBe('device-123');
    expect(getPolarisDeviceId()).toBe('device-123');
  });

  it('matches the sentinel key routes too', () => {
    expect(isPolarisPublicProvider({
      id: 'custom',
      baseUrl: '/api',
      path: '/chat/completions',
      apiKey: POLARIS_PUBLIC_PROVIDER_KEY
    })).toBe(true);
  });

});
