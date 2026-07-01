import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SUPPORTED_TIERS = new Set(['small', 'medium', 'strong'] as const);

type ValidationModelTier = 'small' | 'medium' | 'strong';

export function parseCsv(raw: string | undefined | null) {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function loadValidationLocalEnv(filePath = '.env.validation.local') {
  const resolvedPath = resolve(process.cwd(), filePath);
  if (!existsSync(resolvedPath)) return;

  const content = readFileSync(resolvedPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    if (!name || process.env[name] !== undefined) continue;

    process.env[name] = stripEnvValueQuotes(rawValue);
  }
}

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

function stripEnvValueQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function resolveValidationModels<T extends { id: string; tier: ValidationModelTier }>(
  raw: string | undefined,
  registry: Record<string, T>,
  fallback: string
) {
  return parseCsv(raw || fallback).map((value) => resolveValidationModel(value, registry));
}

export function resolveValidationProviderMeta(api: string, explicitLabel?: string) {
  const label = explicitLabel?.trim();
  if (label) {
    return {
      label,
      apiHost: tryResolveApiHost(api)
    };
  }

  const apiHost = tryResolveApiHost(api);
  if (!apiHost) {
    return {
      label: 'custom',
      apiHost: null
    };
  }

  if (apiHost.includes('siliconflow.cn')) {
    return {
      label: 'siliconflow',
      apiHost
    };
  }

  if (apiHost.includes('openrouter.ai')) {
    return {
      label: 'openrouter',
      apiHost
    };
  }

  if (apiHost.includes('openai.com')) {
    return {
      label: 'openai-compatible',
      apiHost
    };
  }

  return {
    label: apiHost,
    apiHost
  };
}

function resolveValidationModel<T extends { id: string; tier: ValidationModelTier }>(
  value: string,
  registry: Record<string, T>
): T {
  const preset = registry[value];
  if (preset) {
    return preset;
  }

  const separatorIndex = value.lastIndexOf('@');
  if (separatorIndex > 0) {
    const id = value.slice(0, separatorIndex).trim();
    const tier = value.slice(separatorIndex + 1).trim();
    assertSupportedTier(value, tier);
    return { id, tier } as T;
  }

  return {
    id: value,
    tier: inferValidationModelTier(value)
  } as T;
}

function inferValidationModelTier(modelId: string): ValidationModelTier {
  const id = modelId.toLowerCase();
  if (/(nano|mini|haiku|7b|8b|small)/.test(id)) {
    return 'small';
  }
  if (/(gpt-5\.4|opus|thinking|o1|o3|reasoning|grok-4)/.test(id)) {
    return 'strong';
  }
  return 'medium';
}

function assertSupportedTier(rawValue: string, tier: string): asserts tier is ValidationModelTier {
  if (!SUPPORTED_TIERS.has(tier as ValidationModelTier)) {
    throw new Error(`unknown model tier in "${rawValue}": ${tier}`);
  }
}

function tryResolveApiHost(api: string) {
  try {
    return new URL(api).host;
  } catch {
    return null;
  }
}
