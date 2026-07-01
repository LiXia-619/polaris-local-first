import { describe, expect, it } from 'vitest';
import { resolveProviderProfile } from './provider-runtime/internal/providerProfile';

describe('resolveProviderProfile', () => {
  it('keeps unknown providers advisory instead of hard trimming by a guessed window', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://example.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'custom-model'
    });

    expect(profile.contextWindowTokens).toBeNull();
    expect(profile.reservedOutputTokens).toBeNull();
    expect(profile.recommendedPromptTokens).toBe(48_000);
    expect(profile.promptBudgetPolicy).toBe('advisory');
  });

  it('gives claude models a safe budget derived from the large first-party window', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://api.anthropic.com',
      path: '/v1/messages',
      protocol: 'anthropic-messages',
      model: 'claude-sonnet-4-5'
    });

    expect(profile.contextWindowTokens).toBe(200_000);
    expect(profile.reservedOutputTokens).toBe(50_000);
    expect(profile.recommendedPromptTokens).toBe(150_000);
    expect(profile.promptBudgetPolicy).toBe('enforced');
  });

  it('keeps larger claude 4.6 models on the same large-window budget', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://api.anthropic.com',
      path: '/v1/messages',
      protocol: 'anthropic-messages',
      model: 'claude-sonnet-4.6'
    });

    expect(profile.contextWindowTokens).toBe(200_000);
    expect(profile.reservedOutputTokens).toBe(50_000);
    expect(profile.recommendedPromptTokens).toBe(150_000);
    expect(profile.promptBudgetPolicy).toBe('enforced');
  });

  it('does not trust claude model names on custom relays to imply giant context windows', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://relay.example.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'claude-opus-4-6'
    });

    expect(profile.contextWindowTokens).toBeNull();
    expect(profile.recommendedPromptTokens).toBe(48_000);
    expect(profile.promptBudgetPolicy).toBe('advisory');
  });

  it('keeps openrouter claude routes advisory because relay windows are not first-party facts', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://openrouter.ai/api/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'claude-opus-4-6'
    });

    expect(profile.contextWindowTokens).toBeNull();
    expect(profile.recommendedPromptTokens).toBe(48_000);
    expect(profile.promptBudgetPolicy).toBe('advisory');
  });

  it('derives openai-class prompt budgets from the first-party context window', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://api.openai.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'gpt-4o'
    });

    expect(profile.contextWindowTokens).toBe(128_000);
    expect(profile.reservedOutputTokens).toBe(32_000);
    expect(profile.recommendedPromptTokens).toBe(96_000);
    expect(profile.promptBudgetPolicy).toBe('enforced');
  });

  it('recognizes gpt-5 class models as openai-class context windows', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://api.openai.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'gpt-5-mini'
    });

    expect(profile.contextWindowTokens).toBe(128_000);
    expect(profile.recommendedPromptTokens).toBe(96_000);
    expect(profile.promptBudgetPolicy).toBe('enforced');
  });

  it('gives openrouter-hosted open models a medium recommended budget', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://openrouter.ai/api/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'openai/gpt-oss-120b:free'
    });

    expect(profile.contextWindowTokens).toBeNull();
    expect(profile.recommendedPromptTokens).toBe(48_000);
    expect(profile.promptBudgetPolicy).toBe('advisory');
  });

  it('keeps the built-in Polaris route on the medium recommended budget', () => {
    const profile = resolveProviderProfile({
      baseUrl: '/api',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'Polaris'
    });

    expect(profile.contextWindowTokens).toBeNull();
    expect(profile.recommendedPromptTokens).toBe(48_000);
    expect(profile.promptBudgetPolicy).toBe('advisory');
    expect(profile.reasoningContentTransport).toBe('openai-reasoning-content');
  });

  it('does not downgrade custom relays into proxy compatibility mode', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://relay.example.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'custom-model'
    });

    expect(profile.compatibilityMode).toBe('standard');
    expect(profile.collapseSystemMessages).toBe(false);
    expect(profile.sendThinkingBudget).toBe(true);
    expect(profile.reasoningContentTransport).toBe('unsupported');
    expect(profile.supportsToolChoice).toBe(true);
    expect(profile.supportsRequiredToolChoice).toBe(false);
  });

  it('roundtrips OpenAI-compatible reasoning content for Mimo thinking history', () => {
    expect(resolveProviderProfile({
      baseUrl: 'https://api.xiaomimimo.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'custom-alias'
    }).reasoningContentTransport).toBe('openai-reasoning-content');

    expect(resolveProviderProfile({
      baseUrl: 'https://api.xiaomimimo.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'custom-alias'
    }).reasoningContentTransport).toBe('openai-reasoning-content');

    expect(resolveProviderProfile({
      baseUrl: 'https://openrouter.ai/api/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'xiaomi/mimo-v2.5-pro'
    }).reasoningContentTransport).toBe('openai-reasoning-content');
  });

  it('roundtrips DeepSeek thinking history without sending unsupported budget-token controls', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://api.deepseek.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'deepseek-v4-pro'
    });

    expect(profile.reasoningContentTransport).toBe('openai-reasoning-content');
    expect(profile.reasoningContentReplayPolicy).toBe('omit-empty');
    expect(profile.openAiToolHistoryReplayPolicy).toBe('native');
    expect(profile.sendThinkingBudget).toBe(false);
    expect(profile.supportsToolChoice).toBe(false);
    expect(profile.supportsRequiredToolChoice).toBe(false);
  });

  it('keeps required tool choice only for first-party OpenAI-compatible routes', () => {
    expect(resolveProviderProfile({
      baseUrl: 'https://api.openai.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'gpt-5-mini'
    }).supportsRequiredToolChoice).toBe(true);

    expect(resolveProviderProfile({
      baseUrl: 'https://api.deepseek.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'deepseek-chat'
    })).toMatchObject({
      supportsToolChoice: false,
      supportsRequiredToolChoice: false
    });

    expect(resolveProviderProfile({
      baseUrl: 'https://api.moonshot.cn/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'kimi-thinking-preview'
    }).supportsRequiredToolChoice).toBe(false);

    expect(resolveProviderProfile({
      baseUrl: 'https://openrouter.ai/api/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'openrouter/auto'
    }).supportsRequiredToolChoice).toBe(false);
  });

  it('treats direct Moonshot Kimi K2 as thinking-capable without sending a budget-token shape', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://api.moonshot.cn/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'kimi-k2.6'
    });

    expect(profile.sendThinkingBudget).toBe(false);
  });

  it('marks native Gemini routes as native thought-signature transports', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      path: '/models/{model}:generateContent',
      protocol: 'gemini-generate-content',
      model: 'gemini-3.1-pro-preview'
    });

    expect(profile.geminiThoughtSignatureTransport).toBe('native');
  });

  it('marks direct Google OpenAI-compatible Gemini routes as extra-content transports', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'google/gemini-3.1-pro-preview'
    });

    expect(profile.geminiThoughtSignatureTransport).toBe('openai-extra-content');
    expect(profile.openAiToolHistoryReplayPolicy).toBe('native');
  });

  it('marks custom OpenAI-compatible Gemini relays as unsupported thought-signature transports', () => {
    const profile = resolveProviderProfile({
      baseUrl: 'https://relay.example.com/v1',
      path: '/chat/completions',
      protocol: 'openai-completions',
      model: 'google/gemini-3.1-pro-preview'
    });

    expect(profile.geminiThoughtSignatureTransport).toBe('unsupported');
    expect(profile.openAiToolHistoryReplayPolicy).toBe('transcript-when-continuity-unsupported');
  });
});
