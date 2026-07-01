import { describe, expect, it } from 'vitest';
import { buildTrafficReport, parseAccessLog, parseAccessLogLine, summarizeTrafficWindow } from './selfhost-traffic-report';

const browserUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
const botUa = 'Go-http-client/1.1';

describe('parseAccessLogLine', () => {
  it('parses nginx access log entries without keeping query strings in paths', () => {
    const entry = parseAccessLogLine(`203.0.113.10 - - [04/May/2026:15:01:02 +0800] "GET /api/health?x=1 HTTP/1.1" 200 128 "-" "${browserUa}" "-"`);

    expect(entry).toMatchObject({
      ip: '203.0.113.10',
      method: 'GET',
      path: '/api/health',
      status: 200,
      userAgent: browserUa
    });
    expect(entry?.at.toISOString()).toBe('2026-05-04T07:01:02.000Z');
  });

  it('returns null for unrelated lines', () => {
    expect(parseAccessLogLine('not an access log line')).toBeNull();
  });
});

describe('summarizeTrafficWindow', () => {
  it('separates page loads, API usage, health checks, and scanners', () => {
    const entries = parseAccessLog([
      `203.0.113.10 - - [04/May/2026:15:00:00 +0800] "GET / HTTP/1.1" 200 1269 "-" "${browserUa}" "-"`,
      `203.0.113.10 - - [04/May/2026:15:00:01 +0800] "GET /assets/index.js HTTP/1.1" 200 100 "-" "${browserUa}" "-"`,
      `203.0.113.10 - - [04/May/2026:15:00:02 +0800] "POST /api/chat/completions HTTP/1.1" 200 12 "-" "${browserUa}" "-"`,
      `198.51.100.20 - - [04/May/2026:15:00:03 +0800] "GET / HTTP/1.1" 200 1269 "-" "${browserUa}" "-"`,
      `198.51.100.30 - - [04/May/2026:15:00:04 +0800] "GET /health HTTP/1.1" 200 2 "-" "${botUa}" "-"`,
      `198.51.100.40 - - [04/May/2026:15:00:05 +0800] "POST /cgi-bin/luci/ HTTP/1.1" 400 255 "-" "Mozilla/5.0" "-"`
    ].join('\n'));

    const summary = summarizeTrafficWindow(entries, 'today');

    expect(summary.totalRequests).toBe(6);
    expect(summary.appRootPageViews).toBe(2);
    expect(summary.appRootUniqueIps).toBe(2);
    expect(summary.appLoadSessions).toBe(1);
    expect(summary.apiChatCompletions).toBe(1);
    expect(summary.healthChecks).toBe(1);
    expect(summary.botOrCliRequests).toBe(1);
    expect(summary.suspicious4xxScans).toBe(1);
  });
});

describe('buildTrafficReport', () => {
  it('builds today, last 24 hours, and last 7 days windows', () => {
    const entries = parseAccessLog([
      `203.0.113.10 - - [04/May/2026:15:00:00 +0800] "GET / HTTP/1.1" 200 1269 "-" "${browserUa}" "-"`,
      `203.0.113.10 - - [04/May/2026:15:00:01 +0800] "GET /assets/index.js HTTP/1.1" 200 100 "-" "${browserUa}" "-"`,
      `203.0.113.10 - - [03/May/2026:15:00:01 +0800] "GET / HTTP/1.1" 200 1269 "-" "${browserUa}" "-"`
    ].join('\n'));

    const report = buildTrafficReport(entries, 'test', new Date('2026-05-04T09:00:00.000Z'));

    expect(report.windows.map((window) => window.label)).toEqual(['today', 'last_24h', 'last_7d']);
    expect(report.dailyRootPageViews).toEqual([
      ['2026-05-03', 1],
      ['2026-05-04', 1]
    ]);
    expect(report.windows[0].appLoadSessions).toBe(1);
  });
});
