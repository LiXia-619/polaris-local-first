import { describe, expect, it } from 'vitest';
import type { BuiltRequest } from './chatApiTypes';
import { shouldUseNativeIosStreamingFallback } from './chatApiResponse';

function createRequest(stream: boolean): BuiltRequest {
  return {
    endpoint: 'https://example.com/v1/chat/completions',
    headers: {},
    body: stream ? { stream: true } : {},
    provider: 'openai-completions',
    compatibilityMode: 'standard'
  };
}

describe('shouldUseNativeIosStreamingFallback', () => {
  it('keeps native iOS stream requests on the XHR path even when fetch streaming is available', () => {
    expect(shouldUseNativeIosStreamingFallback(createRequest(true), {
      nativePlatform: true,
      platform: 'ios',
      xhrAvailable: true
    })).toBe(true);
  });

  it('does not use the XHR stream fallback outside native iOS', () => {
    expect(shouldUseNativeIosStreamingFallback(createRequest(true), {
      nativePlatform: false,
      platform: 'web',
      xhrAvailable: true
    })).toBe(false);
    expect(shouldUseNativeIosStreamingFallback(createRequest(true), {
      nativePlatform: true,
      platform: 'android',
      xhrAvailable: true
    })).toBe(false);
  });

  it('detects stream requests wrapped for the browser provider relay', () => {
    expect(shouldUseNativeIosStreamingFallback({
      ...createRequest(false),
      endpoint: '/api/provider-relay',
      body: {
        endpoint: 'https://example.com/v1/chat/completions',
        headers: {},
        body: { stream: true }
      }
    }, {
      nativePlatform: true,
      platform: 'ios',
      xhrAvailable: true
    })).toBe(true);
  });

  it('does not use the XHR stream fallback for non-stream requests', () => {
    expect(shouldUseNativeIosStreamingFallback(createRequest(false), {
      nativePlatform: true,
      platform: 'ios',
      xhrAvailable: true
    })).toBe(false);
  });
});
