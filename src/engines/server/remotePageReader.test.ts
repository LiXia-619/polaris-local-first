import { describe, expect, it, vi } from 'vitest';
import {
  assertSafeRemotePageUrl,
  fetchRemotePageWithSafeRedirects,
  resolveSafeRemotePageRedirect
} from './remotePageReader';

describe('assertSafeRemotePageUrl', () => {
  it('rejects local and internal network URLs before fetch', () => {
    expect(() => assertSafeRemotePageUrl('http://localhost:5173')).toThrow('不能读取本地或内网地址。');
    expect(() => assertSafeRemotePageUrl('http://127.0.0.1/private')).toThrow('不能读取本地或内网地址。');
    expect(() => assertSafeRemotePageUrl('http://192.168.1.10/private')).toThrow('不能读取本地或内网地址。');
  });
});

describe('resolveSafeRemotePageRedirect', () => {
  it('validates relative redirect targets against the current URL', () => {
    expect(resolveSafeRemotePageRedirect('https://example.com/docs/start', '../next')).toBe('https://example.com/next');
  });

  it('rejects redirects into local or internal network targets', () => {
    expect(() => resolveSafeRemotePageRedirect('https://example.com', 'http://127.0.0.1/admin'))
      .toThrow('不能读取本地或内网地址。');
  });
});

describe('fetchRemotePageWithSafeRedirects', () => {
  it('uses manual redirects and rejects unsafe redirect targets before fetching them', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('', {
        status: 302,
        headers: {
          location: 'http://127.0.0.1/private'
        }
      })
    );

    await expect(fetchRemotePageWithSafeRedirects('https://example.com/start')).rejects
      .toThrow('不能读取本地或内网地址。');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/start', expect.objectContaining({
      redirect: 'manual'
    }));

    fetchMock.mockRestore();
  });
});
