import type { WebDavConfig } from '../types/domain';

export type WebDavRemoteEntry = {
  href: string;
  url: string;
  name: string;
  lastModified: number | null;
  isDirectory: boolean;
};

const POLARIS_BACKUP_NAME = /^polaris-export-.+\.zip$/i;

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'');
}

function buildNamespacedTagPattern(tagName: string, inner = '([\\s\\S]*?)') {
  return new RegExp(`<(?:[\\w-]+:)?${tagName}\\b[^>]*>${inner}</(?:[\\w-]+:)?${tagName}>`, 'i');
}

function readFirstXmlTagValue(source: string, tagName: string) {
  const match = source.match(buildNamespacedTagPattern(tagName));
  return match?.[1] ? decodeXmlText(match[1].trim()) : null;
}

function hasXmlTag(source: string, tagName: string) {
  return new RegExp(`<(?:[\\w-]+:)?${tagName}(?:\\s|/|>)`, 'i').test(source);
}

function toLastModified(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toEntryName(url: string) {
  const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
  const rawName = pathSegments[pathSegments.length - 1] ?? '';
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

export function normalizeWebDavEndpoint(endpoint: string) {
  return endpoint.trim().replace(/\/+$/, '');
}

export function buildWebDavDirectoryUrl(endpoint: string) {
  const normalized = normalizeWebDavEndpoint(endpoint);
  if (!normalized) {
    throw new Error('请先填写 WebDAV 目录 URL');
  }
  return `${normalized}/`;
}

export function buildWebDavBackupFileUrl(endpoint: string, fileName: string) {
  return `${buildWebDavDirectoryUrl(endpoint)}${encodeURIComponent(fileName)}`;
}

export function createWebDavAuthorizationHeader(username: string, password: string) {
  const credentials = `${username}:${password}`;
  if (typeof btoa === 'function') {
    return `Basic ${btoa(credentials)}`;
  }
  return `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;
}

export function isWebDavConfigured(config: WebDavConfig) {
  return Boolean(config.endpoint.trim() && config.username.trim() && config.password);
}

export function assertWebDavConfigReady(config: WebDavConfig) {
  if (!config.endpoint.trim()) {
    throw new Error('请先填写 WebDAV 目录 URL');
  }
  if (!config.username.trim()) {
    throw new Error('请先填写 WebDAV 用户名');
  }
  if (!config.password) {
    throw new Error('请先填写 WebDAV 密码');
  }
}

export function parseWebDavDirectoryListing(xml: string, directoryUrl: string): WebDavRemoteEntry[] {
  const responsePattern = /<(?:[\w-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?response>/gi;
  const entries: WebDavRemoteEntry[] = [];

  for (const match of xml.matchAll(responsePattern)) {
    const block = match[1];
    if (!block) continue;

    const href = readFirstXmlTagValue(block, 'href');
    if (!href) continue;

    let url: string;
    try {
      url = new URL(href, directoryUrl).toString();
    } catch {
      continue;
    }

    const isDirectory = hasXmlTag(block, 'collection') || href.endsWith('/') || url.endsWith('/');
    entries.push({
      href,
      url,
      name: toEntryName(url),
      lastModified: toLastModified(readFirstXmlTagValue(block, 'getlastmodified')),
      isDirectory
    });
  }

  return entries;
}

export function selectLatestPolarisBackup(entries: WebDavRemoteEntry[]) {
  const backups = entries.filter((entry) => !entry.isDirectory && POLARIS_BACKUP_NAME.test(entry.name));
  if (!backups.length) {
    throw new Error('WebDAV 目录里没有找到 Polaris 备份包');
  }

  return backups
    .slice()
    .sort((left, right) => {
      const leftTime = left.lastModified ?? -1;
      const rightTime = right.lastModified ?? -1;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return right.name.localeCompare(left.name);
    })[0]!;
}

export function formatWebDavStatusError(statusCode: number, action: string) {
  switch (statusCode) {
    case 401:
      return `${action}失败：用户名或密码不对`;
    case 403:
      return `${action}失败：这个 WebDAV 目录没有权限`;
    case 404:
      return `${action}失败：WebDAV 目录或文件不存在`;
    case 405:
      return `${action}失败：这个 WebDAV 服务不接受当前请求`;
    default:
      return `${action}失败（HTTP ${statusCode}）`;
  }
}

export type WebDavTransportErrorOptions = {
  pageProtocol?: string;
};

function readPageProtocol() {
  return typeof globalThis.location?.protocol === 'string' ? globalThis.location.protocol : undefined;
}

function readEndpointProtocol(endpoint: string) {
  try {
    return new URL(buildWebDavDirectoryUrl(endpoint)).protocol;
  } catch {
    return null;
  }
}

export function getWebDavBrowserTransportBlockReason(
  endpoint: string,
  options: WebDavTransportErrorOptions = {}
) {
  const pageProtocol = options.pageProtocol ?? readPageProtocol();
  const endpointProtocol = readEndpointProtocol(endpoint);

  if (pageProtocol === 'https:' && endpointProtocol === 'http:') {
    return '当前 Polaris 是 HTTPS 页面，浏览器会拦截 HTTP WebDAV。请把 WebDAV 服务放到带有效证书的 HTTPS 地址后面，并允许 Polaris 跨域访问；目录末尾的 / 会自动处理，不用手动补。';
  }

  return null;
}

export function formatWebDavTransportError(
  error: unknown,
  endpoint: string,
  action: string,
  options: WebDavTransportErrorOptions = {}
) {
  const blockedReason = getWebDavBrowserTransportBlockReason(endpoint, options);
  if (blockedReason) {
    return `${action}失败：${blockedReason}`;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/Failed to fetch|Load failed|NetworkError|fetch/i.test(message)) {
    return `${action}失败：浏览器没有连上这个 WebDAV 服务。网页端直连 WebDAV 时，服务端需要 HTTPS、有效证书，并允许来自 Polaris 的跨域请求，包括 OPTIONS、PROPFIND、PUT、GET 以及 Authorization、Depth、Content-Type 这些请求头。目录末尾的 / 会自动处理，不用手动补。`;
  }

  return `${action}失败：${message}`;
}
