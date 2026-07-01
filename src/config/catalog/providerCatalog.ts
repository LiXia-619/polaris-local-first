import type { ProviderCapabilities, ProviderProtocol } from '../../types/domain';

export type ProviderRequestPolicy = {
  omitTopPAtOne?: boolean;
  anthropicAuthHeader?: 'x-api-key' | 'authorization-bearer';
};

export type ProviderPreset = {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  path: string;
  defaultModel: string;
  capabilities: ProviderCapabilities;
  models: string[];
  requestPolicy?: ProviderRequestPolicy;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    protocol: 'openai-completions',
    baseUrl: 'https://api.openai.com/v1',
    path: '/chat/completions',
    defaultModel: 'gpt-5-mini',
    capabilities: { images: true, streaming: true, thinking: false },
    models: ['gpt-5.2', 'gpt-5-mini', 'gpt-5.1', 'gpt-4.1']
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    protocol: 'openai-completions',
    baseUrl: 'https://openrouter.ai/api/v1',
    path: '/chat/completions',
    defaultModel: 'openrouter/auto',
    capabilities: { images: true, streaming: true, thinking: false },
    models: [
      'openrouter/auto',
      'deepseek/deepseek-v4-pro',
      'openai/gpt-5.2',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-flash'
    ]
  },
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    protocol: 'openai-completions',
    baseUrl: 'https://opencode.ai/zen/v1',
    path: '/chat/completions',
    defaultModel: 'claude-opus-4-6',
    capabilities: { images: false, streaming: true, thinking: false },
    models: ['claude-opus-4-6'],
    requestPolicy: {
      omitTopPAtOne: true
    }
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    protocol: 'anthropic-messages',
    baseUrl: 'https://api.anthropic.com/v1',
    path: '/messages',
    defaultModel: 'claude-sonnet-4-6',
    capabilities: { images: true, streaming: true, thinking: true },
    models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-sonnet-4']
  },
  {
    id: 'packy-claude',
    name: 'Packy Claude',
    protocol: 'anthropic-messages',
    baseUrl: 'https://www.packyapi.com/v1',
    path: '/messages',
    defaultModel: 'claude-opus-4-6',
    capabilities: { images: true, streaming: true, thinking: true },
    models: ['claude-opus-4-6'],
    requestPolicy: {
      anthropicAuthHeader: 'authorization-bearer'
    }
  },
  {
    id: 'gemini',
    name: 'Gemini',
    protocol: 'gemini-generate-content',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    path: '/models/{model}:generateContent',
    defaultModel: 'gemini-2.5-flash',
    capabilities: { images: true, streaming: false, thinking: true },
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3-flash-preview',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite-preview'
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    protocol: 'openai-completions',
    baseUrl: 'https://api.deepseek.com/v1',
    path: '/chat/completions',
    defaultModel: 'deepseek-chat',
    capabilities: { images: false, streaming: true, thinking: true },
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-v4-pro']
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    protocol: 'openai-completions',
    baseUrl: 'https://api.siliconflow.cn/v1',
    path: '/chat/completions',
    defaultModel: 'moonshotai/Kimi-K2-Instruct',
    capabilities: { images: false, streaming: true, thinking: false },
    models: [
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen3-235B-A22B-Instruct-2507',
      'Qwen/Qwen3-235B-A22B-Thinking-2507',
      'moonshotai/Kimi-K2-Instruct',
      'moonshotai/Kimi-K2-Thinking',
      'deepseek-ai/DeepSeek-R1',
      'Pro/MiniMaxAI/MiniMax-M2.5'
    ]
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    protocol: 'openai-completions',
    baseUrl: 'https://api.moonshot.cn/v1',
    path: '/chat/completions',
    defaultModel: 'kimi-latest',
    capabilities: { images: true, streaming: true, thinking: true },
    models: ['kimi-latest', 'kimi-k2.6', 'kimi-thinking-preview', 'kimi-k2-0905-preview']
  },
  {
    id: 'xiaomi-mimo',
    name: 'Xiaomi MiMo',
    protocol: 'openai-completions',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    path: '/chat/completions',
    defaultModel: 'mimo-v2.5-pro',
    capabilities: { images: false, streaming: true, thinking: false },
    models: ['mimo-v2.5-pro', 'mimo-v2-omni', 'mimo-v2-pro', 'mimo-v2-flash']
  },
  {
    id: 'xai',
    name: 'xAI',
    protocol: 'openai-completions',
    baseUrl: 'https://api.x.ai/v1',
    path: '/chat/completions',
    defaultModel: 'grok-4-fast-non-reasoning',
    capabilities: { images: true, streaming: true, thinking: false },
    models: ['grok-4-fast-non-reasoning', 'grok-4', 'grok-4-fast-reasoning']
  }
];

export function findProviderPreset(baseUrl: string, path?: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/$/, '');
  const normalizedPath = path?.trim();
  return (
    PROVIDER_PRESETS.find((preset) => {
      const presetBaseUrl = preset.baseUrl.replace(/\/$/, '');
      const presetPathMatches = !normalizedPath || preset.path === normalizedPath;
      if (!presetPathMatches) return false;
      if (presetBaseUrl === normalizedBaseUrl) return true;

      if (preset.id === 'siliconflow') {
        return (
          normalizedBaseUrl === 'https://api.siliconflow.com/v1' ||
          normalizedBaseUrl === 'https://api.siliconflow.cn/v1'
        );
      }

      return false;
    }) ?? null
  );
}

export function getProviderPreset(presetId: string) {
  return PROVIDER_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function buildProviderPresetPatch(presetId: string, model?: string) {
  const preset = getProviderPreset(presetId);
  if (!preset) return null;
  return {
    name: preset.name,
    protocol: preset.protocol,
    baseUrl: preset.baseUrl,
    path: preset.path,
    model: model || preset.defaultModel,
    capabilities: preset.capabilities
  };
}
