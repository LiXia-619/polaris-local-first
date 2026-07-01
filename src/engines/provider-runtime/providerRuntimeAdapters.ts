import type { ProviderRuntimeRequestAdapter } from './providerRuntimeRequestTypes';
import { anthropicMessagesAdapter } from './providerRuntimeAnthropicAdapter';
import { geminiGenerateContentAdapter } from './providerRuntimeGeminiAdapter';
import { openAiCompatibleChatAdapter } from './providerRuntimeOpenAiCompatibleAdapter';
import { openAiResponsesAdapter } from './providerRuntimeResponsesAdapter';

export { anthropicMessagesAdapter } from './providerRuntimeAnthropicAdapter';
export { geminiGenerateContentAdapter } from './providerRuntimeGeminiAdapter';
export { openAiCompatibleChatAdapter } from './providerRuntimeOpenAiCompatibleAdapter';
export { openAiResponsesAdapter } from './providerRuntimeResponsesAdapter';

export const providerRuntimeRequestAdapters: readonly ProviderRuntimeRequestAdapter[] = [
  anthropicMessagesAdapter,
  openAiResponsesAdapter,
  geminiGenerateContentAdapter,
  openAiCompatibleChatAdapter
];

export function resolveProviderRuntimeRequestAdapter(
  profile: Parameters<ProviderRuntimeRequestAdapter['match']>[0]
) {
  const matched = providerRuntimeRequestAdapters
    .map((adapter) => ({ adapter, match: adapter.match(profile) }))
    .find((entry) => entry.match);

  if (!matched) {
    throw new Error(`No provider runtime adapter matched provider "${profile.name || profile.id}"`);
  }

  return matched.adapter;
}
