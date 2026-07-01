import { describe, expect, it } from 'vitest';
import {
  builtInChatModelSupportsImages,
  coerceChatPayloadImagesToText,
  prepareBuiltInChatPayloadForModel
} from './builtInChatPayload';

describe('builtInChatPayload', () => {
  it('converts image content parts to text placeholders for text-only built-in models', () => {
    const payload = prepareBuiltInChatPayloadForModel({
      model: 'openai/gpt-oss-120b:free',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '答案' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } }
        ]
      }]
    }, 'openai/gpt-oss-120b:free');

    expect(payload['messages']).toEqual([{
      role: 'user',
      content: '答案\n\n[图片附件：当前内置线路不支持直接看图。]'
    }]);
  });

  it('preserves vision content parts for the built-in image-capable Mimo model', () => {
    const payload = {
      model: 'mimo-v2-omni',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '看图' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc' } }
        ]
      }]
    };

    expect(prepareBuiltInChatPayloadForModel(payload, 'mimo-v2-omni')).toEqual(payload);
    expect(builtInChatModelSupportsImages('xiaomi/mimo-v2-omni')).toBe(true);
  });

  it('leaves non-image structured content untouched', () => {
    const payload = {
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: '纯文字' }]
      }]
    };

    expect(coerceChatPayloadImagesToText(payload)).toEqual(payload);
  });
});
