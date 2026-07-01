import type { ImageGenerationSettings, ImageGenerationSize } from '../types/domain';

const IMAGE_GENERATION_SIZES = new Set<ImageGenerationSize>([
  '1024x1024',
  '1024x1536',
  '1536x1024',
  'auto'
]);

export const DEFAULT_IMAGE_GENERATION_SETTINGS: ImageGenerationSettings = {
  enabled: false,
  size: '1024x1024'
};

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeImageGenerationSize(value: unknown): ImageGenerationSize {
  return typeof value === 'string' && IMAGE_GENERATION_SIZES.has(value as ImageGenerationSize)
    ? value as ImageGenerationSize
    : DEFAULT_IMAGE_GENERATION_SETTINGS.size ?? '1024x1024';
}

export function normalizeImageGenerationSettings(value: unknown): ImageGenerationSettings {
  const settings = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<ImageGenerationSettings>
    : {};

  return {
    enabled: settings.enabled === true,
    providerId: normalizeOptionalString(settings.providerId),
    modelOverride: normalizeOptionalString(settings.modelOverride),
    size: normalizeImageGenerationSize(settings.size),
    lastUpdatedAt: typeof settings.lastUpdatedAt === 'number' && Number.isFinite(settings.lastUpdatedAt)
      ? settings.lastUpdatedAt
      : undefined
  };
}

export function mergeImageGenerationSettings(
  current: ImageGenerationSettings,
  patch: Partial<ImageGenerationSettings>
): ImageGenerationSettings {
  return normalizeImageGenerationSettings({
    ...current,
    ...patch,
    lastUpdatedAt: Date.now()
  });
}
