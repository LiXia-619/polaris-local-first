import type { ModelTier } from '../types/domain';

// Refreshed against official model catalogs on 2026-04-26:
// OpenAI: https://developers.openai.com/api/docs/models
// Anthropic: https://platform.claude.com/docs/en/about-claude/models/overview
// Google Gemini: https://ai.google.dev/gemini-api/docs/models
// OpenRouter uses provider-prefixed model ids like anthropic/claude-sonnet-4.5:
// https://openrouter.ai/docs/api-reference/overview
// SiliconFlow documentation and examples use platform model ids like deepseek-ai/DeepSeek-V3 or Pro/Qwen/...:
// https://docs.siliconflow.cn/cn/usercases/use-siliconcloud-in-KiloCode

type ModelTierInferenceInput =
  | string
  | {
      modelId?: string | null;
      isMirrorAggregator?: boolean;
    };

const KNOWN_MODEL_TIER_MARKERS: Record<ModelTier, string[]> = {
  strong: [
    'gpt-5.4',
    'gpt-5.2-pro',
    'gpt-5.2',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex',
    'gpt-5-codex',
    'gpt-5.1',
    'gpt-5-pro',
    'gpt-5',
    'gpt-4.1',
    'o3-pro',
    'o3-deep-research',
    'o3',
    'claude-opus-4-6',
    'claude-opus-4-5',
    'claude-opus-4-1',
    'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'claude-sonnet-4',
    'deepseek-v4-pro',
    'gemini-2.5-pro',
    'gemini-3.1-pro',
    'gpt-oss-120b'
  ],
  medium: [
    'gpt-5-mini',
    'gpt-4.1-mini',
    'gpt-4o',
    'o4-mini',
    'o3-mini',
    'gemini-3-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gpt-oss-20b'
  ],
  small: [
    'gpt-5-nano',
    'gpt-4.1-nano',
    'gpt-4o-mini',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite'
  ]
};

const FAMILY_SEGMENT_PATTERN = /(claude|gpt|gemini|deepseek|qwen|qwq|llama|mistral|gemma|glm|kimi|doubao|yi|hunyuan|phi|opus|sonnet|haiku|o[134])/i;
const STRONG_MODEL_PATTERN = /(gpt-5(?!.*(?:mini|nano))|gpt-4(?!.*mini)|\bo[134]\b|\bo[134]-|claude|gemini-(?:2\.5|3(?:\.1)?)-pro|\bgemini\b.*\bpro\b|deepseek-(?:r1|v4-pro)|grok-3|kimi-k2)/i;
const SMALL_MODEL_PATTERN = /(\b(?:0\.5|1\.5|2|3|7|8|12|14)b\b|\bnano\b|\btiny\b|\bsmol\b|llama.*\b8b\b|qwen.*\b(?:0\.5|1\.5|3|7)b\b|phi-?\d.*mini|gemma.*\b2b\b)/i;
const MEDIUM_MODEL_PATTERN = /(mini|haiku|flash|lite|air|mistral-large|qwen-(?:plus|max)|llama.*70b)/i;

function normalizeText(value?: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[?#].*$/, '')
    ?? '';
}

function isClaudeModelId(modelId?: string | null) {
  return normalizeText(modelId).includes('claude');
}

function extractModelId(input: ModelTierInferenceInput) {
  return typeof input === 'string' ? input : input.modelId;
}

function normalizeModelId(input: ModelTierInferenceInput) {
  const normalized = normalizeText(extractModelId(input))
    .replace(/\\/g, '/')
    .replace(/:/g, '/')
    .replace(/^models\//, '')
    .replace(/^openai\//, '')
    .replace(/^anthropic\//, '')
    .replace(/^anthropic\./, '')
    .replace(/^google\//, '')
    .replace(/^google\./, '');

  if (!normalized) return '';

  const segments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const familyIndex = segments.findIndex((segment) => FAMILY_SEGMENT_PATTERN.test(segment));

  if (familyIndex !== -1) {
    return segments.slice(familyIndex).join('/');
  }

  return segments.join('/');
}

function lookupKnownModelTier(modelId: string): ModelTier | null {
  let bestMatch: { tier: ModelTier; length: number } | null = null;

  for (const tier of ['strong', 'medium', 'small'] as const) {
    for (const marker of KNOWN_MODEL_TIER_MARKERS[tier]) {
      if (!modelId.includes(marker)) continue;
      if (!bestMatch || marker.length > bestMatch.length) {
        bestMatch = {
          tier,
          length: marker.length
        };
      }
    }
  }

  return bestMatch?.tier ?? null;
}

export function inferModelTier(input?: ModelTierInferenceInput | null): ModelTier {
  const normalized = normalizeModelId(input ?? '');
  if (!normalized) return 'medium';

  const knownTier = lookupKnownModelTier(normalized);
  if (knownTier) return knownTier;

  if (isClaudeModelId(normalized)) {
    return 'strong';
  }

  if (typeof input !== 'string' && input?.isMirrorAggregator && FAMILY_SEGMENT_PATTERN.test(normalized)) {
    if (SMALL_MODEL_PATTERN.test(normalized)) return 'small';
    if (STRONG_MODEL_PATTERN.test(normalized)) return 'strong';
    return 'medium';
  }

  if (STRONG_MODEL_PATTERN.test(normalized)) return 'strong';
  if (SMALL_MODEL_PATTERN.test(normalized)) return 'small';
  if (MEDIUM_MODEL_PATTERN.test(normalized)) return 'medium';
  return 'medium';
}

export function modelTierLabel(tier: ModelTier) {
  switch (tier) {
    case 'strong':
      return '强模型';
    case 'small':
      return '小模型';
    default:
      return '中等模型';
  }
}
