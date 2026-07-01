import { getPolarisDeviceId } from '../../freeProvider';

export const ANTHROPIC_VERSION = '2023-06-01';

export function buildOpenAiCompatibleHeaders(params: {
  apiKey: string;
  extraHeaders: Record<string, string>;
  usesBuiltInTrial: boolean;
}) {
  const { apiKey, extraHeaders, usesBuiltInTrial } = params;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...(usesBuiltInTrial ? { 'X-Polaris-Device-Id': getPolarisDeviceId() } : {}),
    ...extraHeaders
  };
}
