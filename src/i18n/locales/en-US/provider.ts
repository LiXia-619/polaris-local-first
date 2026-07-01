import type { provider as zhProvider } from '../zh-CN/provider';

export const provider = {
  'provider.protocol.openaiCompletions': 'OpenAI compatible',
  'provider.protocol.anthropicMessages': 'Anthropic compatible',
  'provider.protocol.openaiResponses': 'Responses API',
  'provider.protocol.geminiGenerateContent': 'Gemini native',
  'provider.route.gateway': 'Built-in /api relay',
  'provider.route.siliconFlow': 'Direct SiliconFlow',
  'provider.route.openRouter': 'Direct OpenRouter',
  'provider.route.openAI': 'Direct OpenAI',
  'provider.route.anthropic': 'Direct Anthropic',
  'provider.route.gemini': 'Direct Gemini',
  'provider.route.miniMax': 'Direct MiniMax',
  'provider.route.customDirect': 'Direct custom endpoint',
} satisfies Record<keyof typeof zhProvider, string>;
