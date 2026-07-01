import type { ProviderProfile } from '../../types/domain';
import type { AssistantRequestToolChoice } from '../request/requestContext';
import {
  type ProviderCapabilityAdvanced,
  resolveProviderCapabilityCanonicalSet,
  resolveRuntimeProviderProfile as resolveProviderCapabilityRuntimeProfile
} from './providerCapability';
import type { CanonicalProviderCapabilitySet } from './providerRuntimeTypes';

export function resolveRuntimeProviderProfile(
  provider: ProviderProfile,
  advanced?: ProviderCapabilityAdvanced
): ProviderProfile {
  return resolveProviderCapabilityRuntimeProfile(provider, advanced);
}

export function resolveCanonicalProviderCapabilities(
  provider: ProviderProfile,
  advanced?: ProviderCapabilityAdvanced
): CanonicalProviderCapabilitySet {
  return resolveProviderCapabilityCanonicalSet(provider, advanced);
}

export function providerRuntimeSupportsImageInput(
  provider: ProviderProfile,
  advanced?: ProviderCapabilityAdvanced
) {
  return resolveCanonicalProviderCapabilities(provider, advanced).input.images !== 'none';
}

export function resolveProviderRuntimeToolChoice(
  toolChoice: AssistantRequestToolChoice | undefined,
  capabilities: CanonicalProviderCapabilitySet
): AssistantRequestToolChoice | undefined {
  if (!toolChoice || capabilities.tools.choiceControl === 'none') return undefined;
  if (toolChoice !== 'required') return toolChoice;
  return capabilities.tools.choiceControl === 'required' ? 'required' : 'auto';
}

export function resolveProviderRuntimeContextTokenBudget(
  budgets: Pick<CanonicalProviderCapabilitySet['budgets'], 'recommendedPromptTokens' | 'promptBudgetPolicy'>,
  unboundedBudget: number
) {
  if (budgets.promptBudgetPolicy !== 'enforced') {
    return unboundedBudget;
  }
  return budgets.recommendedPromptTokens ?? unboundedBudget;
}
