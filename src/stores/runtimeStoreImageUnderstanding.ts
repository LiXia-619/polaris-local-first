import type { ImageUnderstandingSettings } from '../types/domain';

export const DEFAULT_IMAGE_UNDERSTANDING_SETTINGS: ImageUnderstandingSettings = {
  enabled: false
};

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function normalizeImageUnderstandingSettings(value: unknown): ImageUnderstandingSettings {
  const settings = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<ImageUnderstandingSettings>
    : {};

  return {
    enabled: settings.enabled === true,
    providerId: normalizeOptionalString(settings.providerId),
    modelOverride: normalizeOptionalString(settings.modelOverride),
    lastUpdatedAt: typeof settings.lastUpdatedAt === 'number' && Number.isFinite(settings.lastUpdatedAt)
      ? settings.lastUpdatedAt
      : undefined
  };
}

export function mergeImageUnderstandingSettings(
  current: ImageUnderstandingSettings,
  patch: Partial<ImageUnderstandingSettings>
): ImageUnderstandingSettings {
  return normalizeImageUnderstandingSettings({
    ...current,
    ...patch,
    lastUpdatedAt: Date.now()
  });
}
