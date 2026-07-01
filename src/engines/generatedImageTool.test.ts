import { describe, expect, it } from 'vitest';
import type { ProviderProfile } from '../types/domain';
import {
  generateImageAttachment,
  resolveImageGenerationProvider
} from './generatedImageTool';

const globalApi: ProviderProfile = {
  id: 'global',
  name: 'Global Chat',
  protocol: 'openai-completions',
  baseUrl: 'https://global.test/v1',
  path: '/chat/completions',
  apiKey: 'sk-global',
  model: 'chat-model',
  capabilities: {
    images: false,
    streaming: true,
    thinking: false
  }
};

const imageProvider: ProviderProfile = {
  ...globalApi,
  id: 'image-provider',
  name: 'Image Provider',
  model: 'gpt-image-1',
  capabilities: {
    ...globalApi.capabilities,
    images: true
  }
};

describe('resolveImageGenerationProvider', () => {
  it('selects the configured image provider', () => {
    expect(resolveImageGenerationProvider({
      settings: {
        enabled: true,
        providerId: 'image-provider'
      },
      providers: [imageProvider]
    })).toBe(imageProvider);
  });

  it('does not use the global chat provider when image provider is not configured', () => {
    expect(resolveImageGenerationProvider({
      settings: {
        enabled: true
      },
      providers: [imageProvider]
    })).toBeNull();
  });
});

describe('generateImageAttachment', () => {
  it('asks the user to configure an image provider instead of falling back to global chat', async () => {
    const result = await generateImageAttachment({
      prompt: '画一张星星小屋',
      settings: {
        enabled: true
      },
      providers: [imageProvider],
      globalApi
    });

    expect(result).toEqual({
      ok: false,
      error: '请先在生成设置里选择图像供应商。'
    });
  });
});
