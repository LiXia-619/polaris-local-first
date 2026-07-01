import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderProfile } from '../../types/domain';
import type { BuiltRequest } from './chatApiTypes';
import {
  hasProviderRelayAuthHeader,
  isAllowedProviderRelayTarget,
  isProviderModelListRelayTarget,
  sanitizeProviderRelayHeaders,
  shouldUseBrowserProviderRelay
} from './providerRelay';

const nativePlatform = vi.hoisted(() => ({ value: false }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => nativePlatform.value
  }
}));

function createProvider(overrides: Partial<ProviderProfile> = {}): ProviderProfile {
  return {
    id: 'provider-1',
    name: 'Custom',
    protocol: 'openai-completions',
    baseUrl: 'https://relay.example.com/v1',
    path: '/chat/completions',
    apiKey: 'sk-test',
    model: 'gpt-test',
    capabilities: {
      images: false,
      streaming: true,
      thinking: false
    },
    ...overrides
  };
}

function createRequest(overrides: Partial<BuiltRequest> = {}): BuiltRequest {
  return {
    endpoint: 'https://relay.example.com/v1/chat/completions',
    headers: {
      Authorization: 'Bearer sk-test',
      'Content-Type': 'application/json'
    },
    body: {
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'ping' }]
    },
    provider: 'openai-completions',
    compatibilityMode: 'proxy',
    ...overrides
  };
}

describe('shouldUseBrowserProviderRelay', () => {
  beforeEach(() => {
    nativePlatform.value = false;
    vi.stubGlobal('window', {
      location: { origin: 'https://polaris-public-demo.vercel.app' }
    });
  });

  it('keeps native providers off the browser relay so iOS streaming can stay direct', () => {
    nativePlatform.value = true;
    vi.stubGlobal('window', {
      location: { origin: 'capacitor://localhost' }
    });

    expect(shouldUseBrowserProviderRelay(createProvider(), createRequest())).toBe(false);
  });

  it('routes custom direct providers through the browser relay', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://polaris-public-demo.vercel.app' }
    });

    expect(shouldUseBrowserProviderRelay(createProvider(), createRequest())).toBe(true);
  });

  it('routes official direct providers through the browser relay too', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://polaris-public-demo.vercel.app' }
    });

    expect(
      shouldUseBrowserProviderRelay(
        createProvider({
          baseUrl: 'https://api.openai.com/v1'
        }),
        createRequest({
          endpoint: 'https://api.openai.com/v1/chat/completions',
          compatibilityMode: 'standard'
        })
      )
    ).toBe(true);
  });

  it('keeps same-origin requests off the relay', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://polaris-public-demo.vercel.app' }
    });

    expect(
      shouldUseBrowserProviderRelay(
        createProvider({
          baseUrl: 'https://polaris-public-demo.vercel.app/api'
        }),
        createRequest({
          endpoint: 'https://polaris-public-demo.vercel.app/api/chat/completions'
        })
      )
    ).toBe(false);
  });

  it('keeps built-in trial requests off the relay even on native', () => {
    nativePlatform.value = true;
    vi.stubGlobal('window', {
      location: { origin: 'capacitor://localhost' }
    });

    expect(
      shouldUseBrowserProviderRelay(
        createProvider(),
        createRequest({
          usesBuiltInTrial: true
        })
      )
    ).toBe(false);
  });

  it('keeps official Anthropic messages requests direct in browsers', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://polaris-public-demo.vercel.app' }
    });

    expect(
      shouldUseBrowserProviderRelay(
        createProvider({
          protocol: 'anthropic-messages',
          baseUrl: 'https://api.anthropic.com/v1',
          path: '/messages',
          model: 'claude-sonnet-4-5'
        }),
        createRequest({
          endpoint: 'https://api.anthropic.com/v1/messages',
          provider: 'anthropic-messages',
          compatibilityMode: 'standard'
        })
      )
    ).toBe(false);
  });

  it('still routes Anthropic-compatible proxy hosts through the browser relay', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://polaris-public-demo.vercel.app' }
    });

    expect(
      shouldUseBrowserProviderRelay(
        createProvider({
          protocol: 'anthropic-messages',
          baseUrl: 'https://www.packyapi.com/v1',
          path: '/messages',
          model: 'claude-opus-4-6'
        }),
        createRequest({
          endpoint: 'https://www.packyapi.com/v1/messages',
          provider: 'anthropic-messages',
          compatibilityMode: 'proxy'
        })
      )
    ).toBe(true);
  });
});

describe('isAllowedProviderRelayTarget', () => {
  it('accepts supported public https model endpoints', () => {
    expect(isAllowedProviderRelayTarget('https://opencode.ai/zen/v1/messages')).toBe(true);
    expect(isAllowedProviderRelayTarget('https://relay.example.com/v1/chat/completions')).toBe(true);
    expect(isAllowedProviderRelayTarget('https://api.minimax.chat/v1/text/chatcompletion_v2')).toBe(true);
    expect(isAllowedProviderRelayTarget('https://relay.example.com/v42/llm')).toBe(true);
    expect(
      isAllowedProviderRelayTarget(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      )
    ).toBe(true);
    expect(isAllowedProviderRelayTarget('https://fcm.googleapis.com/v1/messages')).toBe(true);
    expect(isAllowedProviderRelayTarget('https://relay.example.com/v1/chat/completion_pro')).toBe(true);
    expect(isAllowedProviderRelayTarget('https://relay.example.com/v1/models')).toBe(true);
  });

  it('rejects private, local, or unsupported targets', () => {
    expect(isAllowedProviderRelayTarget('http://relay.example.com/v1/messages')).toBe(false);
    expect(isAllowedProviderRelayTarget('https://127.0.0.1/v1/messages')).toBe(false);
    expect(isAllowedProviderRelayTarget('https://[::ffff:127.0.0.1]/v1/messages')).toBe(false);
    expect(isAllowedProviderRelayTarget('https://[fc00::1]/v1/messages')).toBe(false);
    expect(isAllowedProviderRelayTarget('https://[fe80::1]/v1/messages')).toBe(false);
    expect(isAllowedProviderRelayTarget('https://relay.example.com/v1/embeddings')).toBe(false);
    expect(isAllowedProviderRelayTarget('https://relay.example.com/v1/files')).toBe(false);
    expect(isAllowedProviderRelayTarget('https://relay.example.com/v1/uploads')).toBe(false);
  });
});

describe('isProviderModelListRelayTarget', () => {
  it('accepts only public /models targets', () => {
    expect(isProviderModelListRelayTarget('https://relay.example.com/v1/models')).toBe(true);
    expect(isProviderModelListRelayTarget('https://relay.example.com/v1/chat/completions')).toBe(false);
    expect(isProviderModelListRelayTarget('https://127.0.0.1/v1/models')).toBe(false);
  });
});

describe('sanitizeProviderRelayHeaders', () => {
  it('drops hop-by-hop and origin headers', () => {
    expect(
      sanitizeProviderRelayHeaders({
        Authorization: 'Bearer sk-test',
        Host: 'relay.example.com',
        Origin: 'https://polaris-public-demo.vercel.app',
        'X-Custom': 'ok'
      })
    ).toEqual({
      Authorization: 'Bearer sk-test',
      'X-Custom': 'ok'
    });
  });
});

describe('hasProviderRelayAuthHeader', () => {
  it('accepts Gemini x-goog-api-key as upstream auth', () => {
    expect(hasProviderRelayAuthHeader({ 'x-goog-api-key': 'gemini-key' })).toBe(true);
    expect(hasProviderRelayAuthHeader({ Authorization: 'Bearer sk-test' })).toBe(true);
    expect(hasProviderRelayAuthHeader({ 'x-api-key': 'anthropic-key' })).toBe(true);
    expect(hasProviderRelayAuthHeader({ 'xi-api-key': 'elevenlabs-key' })).toBe(true);
    expect(hasProviderRelayAuthHeader({ 'X-Custom': 'not-auth' })).toBe(false);
  });
});
