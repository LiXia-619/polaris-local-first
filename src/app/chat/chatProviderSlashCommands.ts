import type { ProviderProfile } from '../../types/domain';

function normalizeProviderCommandText(value: string) {
  return value.trim().toLowerCase();
}

function providerLookupFields(provider: ProviderProfile) {
  return [
    provider.id,
    provider.name,
    provider.baseUrl,
    provider.model
  ].map(normalizeProviderCommandText).filter(Boolean);
}

export function findProviderForSlashCommand(
  providers: ProviderProfile[],
  query: string
): ProviderProfile | null {
  const normalizedQuery = normalizeProviderCommandText(query);
  if (!normalizedQuery) return null;

  return providers.find((provider) =>
    providerLookupFields(provider).some((field) => field === normalizedQuery)
  ) ?? providers.find((provider) =>
    providerLookupFields(provider).some((field) => field.includes(normalizedQuery))
  ) ?? null;
}
