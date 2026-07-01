import type { AssistantToolAction } from './assistantToolProtocolTypes';
import { normalizeStringArray } from './assistantToolProtocolShared';

export type ParseActionResult =
  | { action: AssistantToolAction; issue?: undefined }
  | { action: null; issue?: string };

export function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function normalizePositiveInt(value: unknown): number | undefined {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : undefined;
}

export function normalizeSaveAttachmentMode(value: unknown): 'codeCard' | 'imageCard' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'codecard') return 'codeCard';
  if (normalized === 'imagecard') return 'imageCard';
  return null;
}

export function normalizeMemoryItems(action: Record<string, unknown>) {
  const directMemory = normalizeStringArray(action.memory);
  if (directMemory.length) return directMemory;

  const itemList = normalizeStringArray(action.items);
  if (itemList.length) return itemList;

  const memories = normalizeStringArray(action.memories);
  if (memories.length) return memories;

  const singleValue =
    typeof action.memory === 'string'
      ? action.memory
      : typeof action.item === 'string'
        ? action.item
        : typeof action.text === 'string'
          ? action.text
          : '';

  const trimmed = singleValue.trim();
  return trimmed ? [trimmed] : [];
}
