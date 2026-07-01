import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isProviderImageGenerationRequestBody
} from '../src/engines/chat-api/providerImageRelayShared.js';
import { hasProviderRelayAuthHeader, sanitizeProviderRelayHeaders } from '../src/engines/chat-api/providerRelay.js';
import { isAllowedPolarisApiOrigin } from '../src/engines/server/corsOrigin.js';
import {
  ProviderImageRelayTargetError,
  validateProviderImageRelayTarget
} from '../server/providerImageRelayTarget.js';

function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  if (isAllowedPolarisApiOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

type ImageRelayRequestBody = {
  endpoint?: unknown;
  headers?: unknown;
  body?: unknown;
};

function parseRelayBody(req: VercelRequest): ImageRelayRequestBody {
  return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
}

function sendImageFailure(res: VercelResponse, error: unknown) {
  if (error instanceof ProviderImageRelayTargetError) {
    res.status(400).json({ error: { message: error.message, type: 'invalid_upstream' } });
    return;
  }
  res.status(502).json({ error: { message: '图片生成 relay 请求失败。', type: 'relay_error' } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed', type: 'invalid_request' } });
    return;
  }

  try {
    const payload = parseRelayBody(req);
    const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
    await validateProviderImageRelayTarget(endpoint);

    if (!isProviderImageGenerationRequestBody(payload.body)) {
      res.status(400).json({
        error: {
          message: '图片生成 relay 请求体必须包含 model 和 prompt。',
          type: 'invalid_request'
        }
      });
      return;
    }

    const relayHeaders = sanitizeProviderRelayHeaders(
      payload.headers && typeof payload.headers === 'object' && !Array.isArray(payload.headers)
        ? Object.fromEntries(
            Object.entries(payload.headers as Record<string, unknown>).map(([key, value]) => [key, String(value)])
          )
        : {}
    );
    if (!hasProviderRelayAuthHeader(relayHeaders)) {
      res.status(400).json({
        error: {
          message: '图片生成 relay 请求缺少上游认证头。',
          type: 'missing_upstream_auth'
        }
      });
      return;
    }

    const upstreamResponse = await fetch(endpoint, {
      method: 'POST',
      headers: relayHeaders,
      body: JSON.stringify(payload.body)
    });
    const text = await upstreamResponse.text();

    res.status(upstreamResponse.status);
    res.setHeader('Cache-Control', 'no-store');
    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.send(text);
  } catch (error) {
    sendImageFailure(res, error);
  }
}
