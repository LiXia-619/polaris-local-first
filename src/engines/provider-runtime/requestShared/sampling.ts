import type { PersonaAdvancedSettings, ProviderProfile } from '../../../types/domain';
import type { AssistantRequestContext } from '../../request/requestContext';
import { resolveProviderCapability, type ProviderCapability } from '../providerCapability';

export function parseJsonObject(input: string | undefined, label: string): Record<string, unknown> {
  const trimmed = input?.trim();
  if (!trimmed) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${label} 必须是 JSON 对象`);
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${label} 必须是 JSON 对象`);
  }

  return parsed as Record<string, unknown>;
}

export function parseHeaderOverrides(input: string | undefined): Record<string, string> {
  const parsed = parseJsonObject(input, '自定义 Header');
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, typeof value === 'string' ? value : String(value)])
  );
}

function formatValueError(label: string, message: string) {
  const separator = /^[\x00-\x7F]+$/.test(label) ? ' ' : '';
  return `${label}${separator}${message}`;
}

export function parseOptionalNumber(
  input: string | undefined,
  label: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): number | undefined {
  const trimmed = input?.trim();
  if (!trimmed) return undefined;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new Error(formatValueError(label, '必须是数字'));
  }
  if (options.min !== undefined && value < options.min) {
    throw new Error(formatValueError(label, `不能小于 ${options.min}`));
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(formatValueError(label, `不能大于 ${options.max}`));
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new Error(formatValueError(label, '必须是整数'));
  }

  return value;
}

export function shouldSendTopP(
  capability: ProviderCapability,
  topP: number | undefined
) {
  if (topP === undefined) return false;

  if (!capability.sampling.sendTopP) {
    return false;
  }

  return !(capability.sampling.omitTopPWhenOne && topP === 1);
}

export function shouldSendTemperature(
  capability: ProviderCapability,
  topP: number | undefined,
  temperature: number | undefined
) {
  if (temperature === undefined) return false;

  if (!capability.sampling.sendTemperature) {
    return false;
  }

  if (capability.sampling.omitTemperatureWhenTopPSet && topP !== undefined) {
    return false;
  }

  return true;
}

export function resolveOpenAiToolChoice(
  toolChoice: AssistantRequestContext['toolChoice'],
  capability: ProviderCapability
) {
  if (capability.tools.choiceControl === 'none') return undefined;
  if (!toolChoice || toolChoice === 'none') return undefined;
  if (toolChoice !== 'required') return toolChoice;
  return capability.tools.choiceControl === 'required' ? 'required' : 'auto';
}

export function resolveRequestBuilderBase(
  api: ProviderProfile,
  advanced?: PersonaAdvancedSettings
) {
  const providerCapability = resolveProviderCapability(api, advanced);
  const model = providerCapability.provider.model;
  const shouldParseThinkingBudget = providerCapability.thinking.effortMapping !== 'none';

  return {
    apiKey: api.apiKey.trim(),
    model,
    temperature: parseOptionalNumber(advanced?.temperature, 'temperature', { min: 0, max: 2 }),
    topP: parseOptionalNumber(advanced?.topP, 'topP', { min: 0, max: 1 }),
    maxTokens: parseOptionalNumber(advanced?.maxTokens, 'maxTokens', { min: 1, integer: true }),
    thinkingBudget: shouldParseThinkingBudget
      ? parseOptionalNumber(advanced?.thinkingBudget, '思考预算', { min: 1, integer: true })
      : undefined,
    extraHeaders: parseHeaderOverrides(advanced?.customHeaders),
    customBody: parseJsonObject(advanced?.customBody, '自定义 Body'),
    providerCapability,
    usesBuiltInTrial: providerCapability.route.isBuiltInTrial
  };
}
