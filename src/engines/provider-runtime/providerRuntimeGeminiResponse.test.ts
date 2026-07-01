import { describe, expect, it } from 'vitest';
import { extractGeminiNativeReply } from './providerRuntimeGeminiResponse';

describe('extractGeminiNativeReply', () => {
  it('surfaces Gemini error payloads before empty response handling', () => {
    expect(() => extractGeminiNativeReply({
      error: {
        code: 400,
        message: 'API key not valid.',
        status: 'INVALID_ARGUMENT'
      }
    }, 'fallback-model')).toThrow('API key not valid.');
  });

  it('parses Gemini text and function calls with thought signatures', () => {
    const reply = extractGeminiNativeReply({
      modelVersion: 'gemini-3.1-pro-preview',
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 4,
        totalTokenCount: 20,
        thoughtsTokenCount: 6
      },
      candidates: [{
        finishReason: 'STOP',
        content: {
          role: 'model',
          parts: [
            { text: '我先看一下。' },
            {
              functionCall: {
                id: 'call-1',
                name: 'patchRawCss',
                args: { css: 'body { color: red; }' }
              },
              thoughtSignature: 'sig-a'
            }
          ]
        }
      }]
    }, 'fallback-model');

    expect(reply.content).toBe('我先看一下。');
    expect(reply.model).toBe('gemini-3.1-pro-preview');
    expect(reply.tokenCount).toBe(20);
    expect(reply.tokenUsage).toEqual({
      totalTokens: 20,
      inputTokens: 10,
      outputTokens: 4,
      reasoningTokens: 6
    });
    expect(reply.nativeToolCalls).toEqual([{
      id: 'call-1',
      name: 'patchRawCss',
      argumentsText: '{"css":"body { color: red; }"}',
      providerMetadata: {
        geminiThoughtSignature: 'sig-a'
      }
    }]);
  });
});
