import type { ThemeVariables } from '../../types/domain';

export function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeThemeVariables(value: unknown): ThemeVariables | null {
  const object = asObject(value);
  if (!object) return null;
  const entries = Object.entries(object)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, itemValue]) => [key.trim(), itemValue.trim()] as const)
    .filter(([key, itemValue]) => key.length > 0 && itemValue.length > 0);
  return entries.length ? Object.fromEntries(entries) : null;
}
