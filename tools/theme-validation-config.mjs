import { parseCsv } from './theme-validation-shared.mjs';

const SUPPORTED_TIERS = new Set(['small', 'medium', 'strong']);

export function resolveValidationApiKey() {
  return (
    process.env.VALIDATION_API_KEY
    || process.env.OPENROUTER_KEY
    || process.env.OPENROUTER_API_KEY
    || process.env.SILICON_KEY
    || process.env.SILICONFLOW_API_KEY
    || process.env.OPENAI_API_KEY
    || ''
  );
}

export function resolveValidationModels(raw, registry, fallback) {
  return parseCsv(raw || fallback).map((value) => resolveValidationModel(value, registry));
}

function resolveValidationModel(value, registry) {
  const preset = registry[value];
  if (preset) {
    return preset;
  }

  const separatorIndex = value.lastIndexOf('@');
  if (separatorIndex > 0) {
    const id = value.slice(0, separatorIndex).trim();
    const tier = value.slice(separatorIndex + 1).trim();
    assertSupportedTier(value, tier);
    return { id, tier };
  }

  return {
    id: value,
    tier: inferValidationModelTier(value)
  };
}

function inferValidationModelTier(modelId) {
  const id = modelId.toLowerCase();
  if (/(nano|mini|haiku|7b|8b|small)/.test(id)) {
    return 'small';
  }
  if (/(gpt-5\.4|opus|thinking|o1|o3|reasoning|grok-4)/.test(id)) {
    return 'strong';
  }
  return 'medium';
}

function assertSupportedTier(rawValue, tier) {
  if (!SUPPORTED_TIERS.has(tier)) {
    throw new Error(`unknown model tier in "${rawValue}": ${tier}`);
  }
}
