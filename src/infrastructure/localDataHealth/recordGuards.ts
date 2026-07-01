/**
 * Generic, domain-agnostic guards for reading untyped JSON evidence at the health/census boundary.
 * These know nothing about specific storage keys — they only narrow shape. Concern-private readers
 * (chat conversation ids, persona memory owners, etc.) live with their concern; only guards shared
 * by more than one concern belong here.
 */

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function readRecordArray(value: unknown, key: string) {
  return isPlainRecord(value) && Array.isArray(value[key]) ? value[key] : [];
}
