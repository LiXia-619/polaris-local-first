import { describe, expect, it } from 'vitest';
import {
  buildWebDavBackupFileUrl,
  buildWebDavDirectoryUrl,
  formatWebDavTransportError,
  getWebDavBrowserTransportBlockReason,
  normalizeWebDavEndpoint,
  parseWebDavDirectoryListing,
  selectLatestPolarisBackup
} from './webdavBackup';

describe('normalizeWebDavEndpoint', () => {
  it('strips surrounding whitespace and trailing slashes', () => {
    expect(normalizeWebDavEndpoint(' https://dav.example.com/backup/// ')).toBe('https://dav.example.com/backup');
  });
});

describe('buildWebDavDirectoryUrl', () => {
  it('normalizes a directory url with a single trailing slash', () => {
    expect(buildWebDavDirectoryUrl('https://dav.example.com/backup///')).toBe('https://dav.example.com/backup/');
  });
});

describe('buildWebDavBackupFileUrl', () => {
  it('appends the encoded backup file name to the directory url', () => {
    expect(buildWebDavBackupFileUrl('https://dav.example.com/backup', 'polaris export.zip')).toBe(
      'https://dav.example.com/backup/polaris%20export.zip'
    );
  });
});

describe('getWebDavBrowserTransportBlockReason', () => {
  it('explains HTTPS page to HTTP WebDAV blocking', () => {
    expect(
      getWebDavBrowserTransportBlockReason('http://39.105.187.61:8081/Polaris', {
        pageProtocol: 'https:'
      })
    ).toContain('浏览器会拦截 HTTP WebDAV');
  });

  it('does not flag HTTPS WebDAV from an HTTPS page', () => {
    expect(
      getWebDavBrowserTransportBlockReason('https://dav.example.com/Polaris', {
        pageProtocol: 'https:'
      })
    ).toBeNull();
  });
});

describe('formatWebDavTransportError', () => {
  it('keeps mixed-content failures actionable instead of raw fetch text', () => {
    expect(
      formatWebDavTransportError(new Error('Failed to fetch'), 'http://39.105.187.61:8081/Polaris', '上传 WebDAV 备份', {
        pageProtocol: 'https:'
      })
    ).toContain('当前 Polaris 是 HTTPS 页面');
  });

  it('explains browser fetch failures as WebDAV transport configuration issues', () => {
    expect(
      formatWebDavTransportError(new Error('Failed to fetch'), 'https://dav.example.com/Polaris', '读取 WebDAV 目录', {
        pageProtocol: 'https:'
      })
    ).toContain('服务端需要 HTTPS、有效证书');
  });
});

describe('parseWebDavDirectoryListing', () => {
  it('parses namespaced PROPFIND xml into remote entries', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/Polaris/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/Polaris/polaris-export-20260329-2330.zip</d:href>
    <d:propstat>
      <d:prop>
        <d:getlastmodified>Sat, 29 Mar 2026 23:30:00 GMT</d:getlastmodified>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/Polaris/polaris-export-20260330-0130.zip</d:href>
    <d:propstat>
      <d:prop>
        <d:getlastmodified>Sun, 30 Mar 2026 01:30:00 GMT</d:getlastmodified>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`;

    const entries = parseWebDavDirectoryListing(xml, 'https://dav.example.com/dav/Polaris/');

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      url: 'https://dav.example.com/dav/Polaris/',
      isDirectory: true
    });
    expect(entries[2]).toMatchObject({
      name: 'polaris-export-20260330-0130.zip',
      isDirectory: false
    });
  });
});

describe('selectLatestPolarisBackup', () => {
  it('prefers the newest Polaris backup in the directory', () => {
    const latest = selectLatestPolarisBackup([
      {
        href: '/dav/Polaris/manual.zip',
        url: 'https://dav.example.com/dav/Polaris/manual.zip',
        name: 'manual.zip',
        lastModified: Date.parse('2026-03-30T02:00:00Z'),
        isDirectory: false
      },
      {
        href: '/dav/Polaris/polaris-export-20260329-2330.zip',
        url: 'https://dav.example.com/dav/Polaris/polaris-export-20260329-2330.zip',
        name: 'polaris-export-20260329-2330.zip',
        lastModified: Date.parse('2026-03-29T23:30:00Z'),
        isDirectory: false
      },
      {
        href: '/dav/Polaris/polaris-export-20260330-0130.zip',
        url: 'https://dav.example.com/dav/Polaris/polaris-export-20260330-0130.zip',
        name: 'polaris-export-20260330-0130.zip',
        lastModified: Date.parse('2026-03-30T01:30:00Z'),
        isDirectory: false
      }
    ]);

    expect(latest.name).toBe('polaris-export-20260330-0130.zip');
  });
});
