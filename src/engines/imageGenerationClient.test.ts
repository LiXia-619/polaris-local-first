import { describe, expect, it, vi } from 'vitest';
import type { ProviderProfile } from '../types/domain';
import { buildImageGenerationEndpoint, requestGeneratedImage } from './imageGenerationClient';

const provider: ProviderProfile = {
  id: 'provider-a',
  name: 'Provider A',
  protocol: 'openai-completions',
  baseUrl: 'https://api.example.com/v1',
  path: '/chat/completions',
  apiKey: 'sk-test',
  model: 'chat-model',
  capabilities: {
    images: true,
    streaming: true,
    thinking: false
  }
};

describe('buildImageGenerationEndpoint', () => {
  it('routes OpenAI-compatible chat paths to images/generations', () => {
    expect(buildImageGenerationEndpoint(provider)).toBe('https://api.example.com/v1/images/generations');
    expect(buildImageGenerationEndpoint({
      ...provider,
      protocol: 'openai-responses',
      path: '/responses'
    })).toBe('https://api.example.com/v1/images/generations');
  });
});

describe('requestGeneratedImage', () => {
  it('requests one base64 image and returns an attachment-ready blob', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      data: [{ b64_json: btoa('png-bytes') }]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));

    const result = await requestGeneratedImage({
      api: provider,
      settings: {
        enabled: true,
        modelOverride: 'gpt-image-1',
        size: '1024x1024'
      },
      prompt: '画一张星星小屋',
      title: '星星小屋',
      fetchImpl: fetchMock as typeof fetch
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/images/generations', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test'
      }
    }));
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody).toEqual({
      model: 'gpt-image-1',
      prompt: '画一张星星小屋',
      n: 1,
      response_format: 'b64_json',
      size: '1024x1024'
    });
    expect(result.fileName).toBe('星星小屋.png');
    expect(result.mimeType).toBe('image/png');
    expect(await result.blob.text()).toBe('png-bytes');
  });
});
