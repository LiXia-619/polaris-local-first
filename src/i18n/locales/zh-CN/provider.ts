export const provider = {
  'provider.protocol.openaiCompletions': 'OpenAI 兼容',
  'provider.protocol.anthropicMessages': 'Anthropic 兼容',
  'provider.protocol.openaiResponses': 'Responses API',
  'provider.protocol.geminiGenerateContent': 'Gemini 原生',
  'provider.route.gateway': '走内置 /api 中转',
  'provider.route.siliconFlow': '直连 SiliconFlow',
  'provider.route.openRouter': '直连 OpenRouter',
  'provider.route.openAI': '直连 OpenAI',
  'provider.route.anthropic': '直连 Anthropic',
  'provider.route.gemini': '直连 Gemini',
  'provider.route.miniMax': '直连 MiniMax',
  'provider.route.customDirect': '直连自定义接口',
} as const;
