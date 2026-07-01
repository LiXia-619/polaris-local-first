import { Capacitor } from '@capacitor/core';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function stripLeadingSlash(value: string): string {
  return value.replace(/^\//, '');
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

function joinUrlParts(base: string, path: string): string {
  const normalizedBase = stripTrailingSlash(base.trim());
  const normalizedPath = stripLeadingSlash(path.trim());
  if (!normalizedBase) return normalizedPath ? `/${normalizedPath}` : '';
  if (!normalizedPath) return normalizedBase;
  return `${normalizedBase}/${normalizedPath}`;
}

function getConfiguredApiOrigin(): string {
  const configuredOrigin = (import.meta.env.VITE_POLARIS_API_ORIGIN ?? '').trim();
  const processEnvOrigin =
    typeof process !== 'undefined'
    && typeof process.env?.VITE_POLARIS_API_ORIGIN === 'string'
      ? process.env.VITE_POLARIS_API_ORIGIN.trim()
      : '';
  const origin = configuredOrigin || processEnvOrigin;
  return origin ? stripTrailingSlash(origin) : '';
}

function getConfiguredApiOriginLabel(): string {
  return '`VITE_POLARIS_API_ORIGIN`';
}

function getRequiredApiOrigin(surface: 'desktop' | 'native'): string {
  const configuredOrigin = getConfiguredApiOrigin();
  if (!configuredOrigin) {
    const surfaceLabel = surface === 'desktop' ? '桌面端' : '原生端';
    throw new Error(`${surfaceLabel}内部 API 需要显式配置 ${getConfiguredApiOriginLabel()}，公开版不会默认连接 Polaris 官方服务器。`);
  }
  return configuredOrigin;
}

function isDesktopCustomScheme(): boolean {
  return (
    typeof window !== 'undefined'
    && window.location?.protocol === 'polaris:'
  );
}

function shouldUseCurrentWebOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.host);
  } catch {
    return false;
  }
}

function getRelativeApiOrigin(): string {
  if (Capacitor.isNativePlatform()) {
    return getRequiredApiOrigin('native');
  }

  if (isDesktopCustomScheme()) {
    return getRequiredApiOrigin('desktop');
  }

  const currentOriginValue =
    typeof window !== 'undefined' && typeof window.location?.origin === 'string'
      ? window.location.origin
      : '';

  if (currentOriginValue) {
    const currentOrigin = stripTrailingSlash(currentOriginValue);
    if (shouldUseCurrentWebOrigin(currentOrigin)) {
      return currentOrigin;
    }
  }

  return getConfiguredApiOrigin();
}

export function buildInternalApiEndpoint(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    throw new Error('内部 API 路径不能为空');
  }

  const relativePath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  const apiOrigin = getRelativeApiOrigin();
  if (!apiOrigin) return relativePath;

  return new URL(relativePath, `${apiOrigin}/`).toString();
}

export function buildApiEndpoint(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.trim();
  if (!normalizedBaseUrl) {
    throw new Error('API Base URL 不能为空');
  }

  if (isAbsoluteUrl(normalizedBaseUrl)) {
    return joinUrlParts(normalizedBaseUrl, path);
  }

  const relativePath = joinUrlParts(normalizedBaseUrl.startsWith('/') ? normalizedBaseUrl : `/${normalizedBaseUrl}`, path);
  const apiOrigin = getRelativeApiOrigin();
  if (!apiOrigin) return relativePath;
  return new URL(relativePath, `${apiOrigin}/`).toString();
}
