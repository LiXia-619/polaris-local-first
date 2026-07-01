import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  formatClientDiagnosticsLog,
  normalizeClientDiagnosticsPayload
} from '../src/engines/clientDiagnostics.js';
import { isAllowedPolarisApiOrigin } from '../src/engines/server/corsOrigin.js';

const DAILY_LIMIT = 200;
const rateCounts = new Map<string, { count: number; date: string }>();

function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  if (isAllowedPolarisApiOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Polaris-Device-Id');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function getUserId(req: VercelRequest): string {
  const deviceId = (req.headers['x-polaris-device-id'] as string | undefined)?.trim();
  if (deviceId) return deviceId;
  const forwarded = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const ip = req.headers['x-real-ip'] as string | undefined;
  return ip?.trim() || 'anonymous';
}

function consumeRateLimit(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = rateCounts.get(userId);
  const nextCount = !entry || entry.date !== today ? 1 : entry.count + 1;
  rateCounts.set(userId, { count: nextCount, date: today });
  return nextCount <= DAILY_LIMIT;
}

function parseBody(req: VercelRequest) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
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

  if (!consumeRateLimit(getUserId(req))) {
    res.status(204).end();
    return;
  }

  try {
    const entry = normalizeClientDiagnosticsPayload(parseBody(req));
    if (!entry) {
      res.status(400).json({ error: { message: 'Invalid diagnostics payload', type: 'invalid_request' } });
      return;
    }
    console.info(formatClientDiagnosticsLog(entry));
    res.status(204).end();
  } catch {
    res.status(400).json({ error: { message: 'Invalid diagnostics payload', type: 'invalid_request' } });
  }
}
