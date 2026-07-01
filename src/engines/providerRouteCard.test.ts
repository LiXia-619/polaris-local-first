import { describe, expect, it } from 'vitest';
import { parseProviderRouteCard, serializeProviderRouteCard } from './providerRouteCard';

describe('serializeProviderRouteCard', () => {
  it('omits apiKey by default', () => {
    const output = serializeProviderRouteCard({
      name: 'Claude 镜像',
      protocol: 'openai-completions',
      baseUrl: 'https://example.com/v1',
      path: '/chat/completions',
      apiKey: 'secret-key',
      model: 'anthropic/claude-sonnet-4',
      capabilities: {
        images: true,
        streaming: true,
        thinking: false
      }
    });

    expect(output).not.toContain('secret-key');
    expect(JSON.parse(output)).toMatchObject({
      type: 'polaris-provider-card',
      version: 1,
      name: 'Claude 镜像'
    });
  });

  it('includes apiKey when requested', () => {
    const output = serializeProviderRouteCard({
      name: 'Claude 镜像',
      protocol: 'openai-completions',
      baseUrl: 'https://example.com/v1',
      path: '/chat/completions',
      apiKey: 'secret-key',
      model: 'anthropic/claude-sonnet-4',
      capabilities: {
        images: true,
        streaming: true,
        thinking: false
      }
    }, { includeApiKey: true });

    expect(JSON.parse(output)).toMatchObject({
      apiKey: 'secret-key'
    });
  });
});

describe('parseProviderRouteCard', () => {
  it('parses exported route cards', () => {
    const parsed = parseProviderRouteCard(`{
      "type": "polaris-provider-card",
      "version": 1,
      "name": "Claude 镜像",
      "baseUrl": "https://example.com/v1",
      "path": "/chat/completions",
      "model": "anthropic/claude-sonnet-4",
      "capabilities": {
        "images": true,
        "streaming": true,
        "thinking": false
      }
    }`);

    expect(parsed).toEqual({
      name: 'Claude 镜像',
      protocol: 'openai-completions',
      baseUrl: 'https://example.com/v1',
      path: '/chat/completions',
      apiKey: '',
      model: 'anthropic/claude-sonnet-4',
      capabilities: {
        images: true,
        streaming: true,
        thinking: false
      }
    });
  });

  it('falls back to preset capabilities for raw provider-shaped json', () => {
    const parsed = parseProviderRouteCard(`{
      "baseUrl": "https://openrouter.ai/api/v1",
      "path": "/chat/completions",
      "model": "openrouter/auto"
    }`);

    expect(parsed).toEqual({
      name: 'OpenRouter',
      protocol: 'openai-completions',
      baseUrl: 'https://openrouter.ai/api/v1',
      path: '/chat/completions',
      apiKey: '',
      model: 'openrouter/auto',
      capabilities: {
        images: true,
        streaming: true,
        thinking: false
      }
    });
  });

  it('rejects non-json input', () => {
    expect(() => parseProviderRouteCard('not json')).toThrow('线路卡必须是 JSON');
  });

  it('infers responses protocol from responses paths when the card omits it', () => {
    const parsed = parseProviderRouteCard(`{
      "baseUrl": "https://api.openai.com/v1",
      "path": "/responses",
      "model": "gpt-5"
    }`);

    expect(parsed.protocol).toBe('openai-responses');
  });

  it('rejects cards without baseUrl', () => {
    expect(() => parseProviderRouteCard(`{"path":"/chat/completions","model":"foo"}`)).toThrow('线路卡 baseUrl 不能为空');
  });
});
