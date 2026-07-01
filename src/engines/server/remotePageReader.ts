const MAX_REMOTE_PAGE_REDIRECTS = 5;

function isPrivateRemotePageHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'localhost' || normalized.endsWith('.local')) return true;
  if (normalized === '::1' || normalized === '[::1]') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    const [a, b] = normalized.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export function assertSafeRemotePageUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('网页地址不合法。');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('只支持读取 http / https 网页。');
  }
  if (isPrivateRemotePageHostname(parsed.hostname)) {
    throw new Error('不能读取本地或内网地址。');
  }
  return parsed.toString();
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

export function resolveSafeRemotePageRedirect(currentUrl: string, location: string | null) {
  if (!location?.trim()) {
    throw new Error('网页跳转缺少目标地址。');
  }
  return assertSafeRemotePageUrl(new URL(location, currentUrl).toString());
}

export async function fetchRemotePageWithSafeRedirects(rawUrl: string, init: RequestInit = {}) {
  let nextUrl = assertSafeRemotePageUrl(rawUrl);
  for (let redirectCount = 0; redirectCount <= MAX_REMOTE_PAGE_REDIRECTS; redirectCount += 1) {
    const response = await fetch(nextUrl, {
      ...init,
      redirect: 'manual'
    });
    if (!isRedirectStatus(response.status)) {
      return {
        response,
        finalUrl: response.url ? assertSafeRemotePageUrl(response.url) : nextUrl
      };
    }

    const location = response.headers.get('location');
    await response.body?.cancel();
    nextUrl = resolveSafeRemotePageRedirect(nextUrl, location);
  }

  throw new Error('网页跳转次数过多。');
}
