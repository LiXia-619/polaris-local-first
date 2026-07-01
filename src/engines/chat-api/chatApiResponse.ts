import { Capacitor } from '@capacitor/core';
import { recordStreamDebug } from './chatApiStreamDebug';
import type { AssistantReply, AssistantReplyProgress, BuiltRequest } from './chatApiTypes';
import { createStreamingReplyCollector } from './chatApiStreamingCollector';
import type { CanonicalProviderStreamEvent } from '../provider-runtime';

const XHR_STREAM_POLL_MS = 120;

type NativeIosStreamingFallbackEnvironment = {
  nativePlatform: boolean;
  platform: string;
  xhrAvailable: boolean;
};

function resolveNativeIosStreamingFallbackEnvironment(): NativeIosStreamingFallbackEnvironment {
  return {
    nativePlatform: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    xhrAvailable: typeof XMLHttpRequest !== 'undefined'
  };
}

export function shouldUseNativeIosStreamingFallback(
  request: BuiltRequest,
  environment: NativeIosStreamingFallbackEnvironment = resolveNativeIosStreamingFallbackEnvironment()
): boolean {
  const nestedBody = request.body.body;
  const requestStreams =
    request.body.stream === true
    || (
      nestedBody !== null
      && typeof nestedBody === 'object'
      && !Array.isArray(nestedBody)
      && (nestedBody as Record<string, unknown>).stream === true
    );

  return (
    requestStreams &&
    environment.xhrAvailable &&
    environment.nativePlatform &&
    environment.platform === 'ios'
  );
}

export async function readStreamingReply(
  response: Response,
  fallbackModel: string,
  onProgress?: (reply: AssistantReplyProgress) => void,
  onChunk?: () => void,
  parseStreamEvents?: (payload: unknown) => CanonicalProviderStreamEvent[]
): Promise<AssistantReply> {
  if (!response.body) {
    throw new Error('Streaming 响应为空');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const isEventStream = response.headers.get('content-type')?.includes('text/event-stream') ?? false;
  const collector = createStreamingReplyCollector(fallbackModel, onProgress, parseStreamEvents);
  const startedAt = Date.now();
  let sawFirstChunk = false;

  recordStreamDebug('fetch-stream-start', {
    contentType: response.headers.get('content-type') ?? 'unknown',
    eventStream: isEventStream
  });

  while (true) {
    onChunk?.();
    const { value, done } = await reader.read();
    onChunk?.();
    const decodedChunk = decoder.decode(value ?? new Uint8Array(), { stream: !done });
    if (!sawFirstChunk && decodedChunk.trim()) {
      sawFirstChunk = true;
      recordStreamDebug('fetch-stream-first-chunk', {
        elapsedMs: Date.now() - startedAt,
        chunkLength: decodedChunk.length
      });
    }
    collector.pushTextChunk(decodedChunk, isEventStream);
    if (done) break;
  }

  recordStreamDebug('fetch-stream-finish', {
    elapsedMs: Date.now() - startedAt,
    firstChunkSeen: sawFirstChunk
  });
  return collector.finish();
}

export async function readStreamingReplyViaXhr(params: {
  request: BuiltRequest;
  fallbackModel: string;
  signal?: AbortSignal;
  onProgress?: (reply: AssistantReplyProgress) => void;
  onChunk?: () => void;
  rawProviderError?: boolean;
  parseStreamEvents?: (payload: unknown) => CanonicalProviderStreamEvent[];
}): Promise<AssistantReply> {
  const { request, fallbackModel, signal, onProgress, onChunk, rawProviderError = false, parseStreamEvents } = params;

  return await new Promise<AssistantReply>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const collector = createStreamingReplyCollector(fallbackModel, onProgress, parseStreamEvents);
    let settled = false;
    let processedLength = 0;
    let isEventStream = false;
    let pollInterval: number | null = null;
    const startedAt = Date.now();
    let sawFirstChunk = false;

    const abortRequest = () => xhr.abort();

    const pushPendingChunk = (source: 'progress' | 'poll' | 'load') => {
      const nextText = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;
      if (!nextText) return;
      if (!sawFirstChunk && nextText.trim()) {
        sawFirstChunk = true;
        recordStreamDebug('xhr-first-chunk', {
          source,
          elapsedMs: Date.now() - startedAt,
          chunkLength: nextText.length
        });
      }
      onChunk?.();
      collector.pushTextChunk(nextText, isEventStream);
      onChunk?.();
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (pollInterval !== null) {
        window.clearInterval(pollInterval);
      }
      signal?.removeEventListener('abort', abortRequest);
      fn();
    };

    xhr.open('POST', request.endpoint, true);
    Object.entries(request.headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState >= XMLHttpRequest.HEADERS_RECEIVED) {
        isEventStream = xhr.getResponseHeader('content-type')?.includes('text/event-stream') ?? false;
        if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
          recordStreamDebug('xhr-headers', {
            contentType: xhr.getResponseHeader('content-type') ?? 'unknown',
            eventStream: isEventStream
          });
        }
      }
    };

    xhr.onprogress = () => pushPendingChunk('progress');
    xhr.onerror = () => finish(() => {
      recordStreamDebug('xhr-error', {
        elapsedMs: Date.now() - startedAt,
        status: xhr.status
      });
      reject(new Error('网络请求失败'));
    });
    xhr.onabort = () => finish(() => {
      recordStreamDebug('xhr-abort', {
        elapsedMs: Date.now() - startedAt,
        status: xhr.status
      });
      reject(
        signal?.aborted
          ? new DOMException('Aborted', 'AbortError')
          : new Error('请求已取消')
      );
    });
    xhr.onload = () => {
      finish(() => {
        try {
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(`API ${xhr.status}: ${xhr.responseText.slice(0, 180)}`));
            return;
          }
          pushPendingChunk('load');
          recordStreamDebug('xhr-load', {
            elapsedMs: Date.now() - startedAt,
            status: xhr.status,
            firstChunkSeen: sawFirstChunk,
            totalLength: xhr.responseText.length
          });
          resolve(collector.finish());
        } catch (error) {
          reject(error instanceof Error ? error : new Error('流式响应解析失败'));
        }
      });
    };

    signal?.addEventListener('abort', abortRequest, { once: true });
    if (typeof window !== 'undefined') {
      pollInterval = window.setInterval(() => pushPendingChunk('poll'), XHR_STREAM_POLL_MS);
    }
    recordStreamDebug('xhr-stream-start', {
      endpoint: request.endpoint.slice(0, 120),
      provider: request.provider
    });
    xhr.send(JSON.stringify(request.body));
  });
}
