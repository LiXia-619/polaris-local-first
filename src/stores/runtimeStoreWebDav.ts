import type { WebDavConfig } from '../types/domain';

export const DEFAULT_WEBDAV_CONFIG: WebDavConfig = {
  endpoint: '',
  username: '',
  password: ''
};

export function normalizeWebDavConfig(config?: Partial<WebDavConfig> | null): WebDavConfig {
  return {
    endpoint: config?.endpoint?.trim().replace(/\/+$/, '') ?? '',
    username: config?.username?.trim() ?? '',
    password: config?.password ?? ''
  };
}

export function mergeWebDavPatch(config: WebDavConfig, patch: Partial<WebDavConfig>): WebDavConfig {
  return normalizeWebDavConfig({
    endpoint: patch.endpoint !== undefined ? patch.endpoint : config.endpoint,
    username: patch.username !== undefined ? patch.username : config.username,
    password: patch.password !== undefined ? patch.password : config.password
  });
}
