import type {
  PersonaAdvancedSettings,
  ProviderProfile
} from '../../types/domain';
import type {
  AssistantRequestContext,
  AssistantRequestTool
} from '../request/requestContext';
import type { ProviderRuntimeCharacterizationFixture } from './providerRuntimeTypes';

export function createProviderRuntimeTestProvider(overrides: Partial<ProviderProfile> = {}): ProviderProfile {
  const { capabilities, ...rest } = overrides;
  return {
    id: 'provider-runtime-test',
    name: 'Provider Runtime Test',
    protocol: 'openai-completions',
    baseUrl: 'https://api.openai.com/v1',
    path: '/chat/completions',
    apiKey: 'test-key',
    model: 'gpt-5-mini',
    ...rest,
    capabilities: {
      images: capabilities?.images ?? false,
      streaming: capabilities?.streaming ?? true,
      thinking: capabilities?.thinking ?? false
    }
  };
}

export function createProviderRuntimeAdvanced(
  overrides: Partial<PersonaAdvancedSettings> = {}
): PersonaAdvancedSettings {
  return {
    modelOverride: '',
    temperature: '0.7',
    topP: '',
    maxTokens: '64',
    thinkingBudget: '',
    contextMessageLimit: '',
    showThinking: true,
    streaming: true,
    customHeaders: '',
    customBody: '',
    regexRules: '',
    snippets: [],
    ...overrides
  };
}

export function createProviderRuntimeTestTool(name = 'patchRawCss'): AssistantRequestTool {
  return {
    type: 'function',
    function: {
      name,
      description: 'Provider runtime conformance fixture tool.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          value: {
            type: 'string'
          }
        },
        required: ['value']
      }
    }
  };
}

export function createProviderRuntimeTestContext(options: {
  withSystem?: boolean;
  withImage?: boolean;
  withTools?: boolean;
  toolChoice?: AssistantRequestContext['toolChoice'];
  withToolHistory?: boolean;
} = {}): AssistantRequestContext {
  const {
    withSystem = true,
    withImage = false,
    withTools = true,
    toolChoice = 'auto',
    withToolHistory = false
  } = options;

  const messages: AssistantRequestContext['segments'][number]['messages'] = [
    ...(withSystem
      ? [{
          role: 'system' as const,
          content: 'You are testing provider runtime boundaries.',
          cachePrefixEligible: true
        }]
      : []),
    {
      role: 'user' as const,
      content: withImage
        ? [
            { type: 'text' as const, text: 'Describe this fixture image.' },
            { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,ZmFrZQ==' } }
          ]
        : 'Please answer with a small provider runtime fixture.'
    }
  ];

  if (withToolHistory) {
    messages.push(
      {
        role: 'assistant',
        content: 'I will call the fixture tool.',
        toolCalls: [{
          id: 'call-runtime-1',
          name: 'patchRawCss',
          argumentsText: '{"value":"ok"}'
        }]
      },
      {
        role: 'tool',
        content: '',
        toolResult: {
          schemaVersion: 1,
          toolCallId: 'call-runtime-1',
          toolName: 'patchRawCss',
          status: 'executed',
          structuredPayload: {
            kind: 'patchRawCss',
            css: '.fixture { color: red; }'
          }
        }
      }
    );
  }

  return {
    memorySlots: {
      session: [],
      profile: [],
      pin: []
    },
    attachmentSlots: {
      enabled: false,
      pending: []
    },
    segments: [{
      kind: 'conversation',
      messages
    }],
    ...(withTools
      ? {
          tools: [createProviderRuntimeTestTool()],
          toolChoice
        }
      : {})
  };
}

export function createProviderRuntimeCharacterizationFixtures(): ProviderRuntimeCharacterizationFixture[] {
  return [
    {
      id: 'openai-compatible-native-tools',
      provider: createProviderRuntimeTestProvider({
        protocol: 'openai-completions',
        baseUrl: 'https://api.openai.com/v1',
        path: '/chat/completions',
        model: 'gpt-5-mini',
        capabilities: {
          images: true,
          streaming: true,
          thinking: false
        }
      }),
      context: createProviderRuntimeTestContext({ withTools: true, toolChoice: 'required' }),
      advanced: createProviderRuntimeAdvanced({ maxTokens: '128' }),
      expected: {
        protocol: 'openai-completions',
        stream: true,
        outputTokenField: 'max_tokens',
        toolMode: 'native',
        reasoningMode: 'none'
      }
    },
    {
      id: 'anthropic-messages-native-tools',
      provider: createProviderRuntimeTestProvider({
        protocol: 'anthropic-messages',
        baseUrl: 'https://api.anthropic.com/v1',
        path: '/messages',
        model: 'claude-sonnet-4',
        capabilities: {
          images: true,
          streaming: true,
          thinking: true
        }
      }),
      context: createProviderRuntimeTestContext({ withTools: true, toolChoice: 'required', withToolHistory: true }),
      advanced: createProviderRuntimeAdvanced({ maxTokens: '256', thinkingBudget: '64' }),
      expected: {
        protocol: 'anthropic-messages',
        stream: true,
        outputTokenField: 'max_tokens',
        toolMode: 'native',
        reasoningMode: 'text'
      }
    },
    {
      id: 'gemini-native-generate-content',
      provider: createProviderRuntimeTestProvider({
        protocol: 'gemini-generate-content',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        path: '/models/{model}:generateContent',
        model: 'gemini-2.5-flash',
        capabilities: {
          images: true,
          streaming: false,
          thinking: true
        }
      }),
      context: createProviderRuntimeTestContext({ withImage: true, withTools: true, toolChoice: 'required' }),
      advanced: createProviderRuntimeAdvanced({ maxTokens: '96', thinkingBudget: '32' }),
      expected: {
        protocol: 'gemini-generate-content',
        stream: false,
        outputTokenField: 'max_output_tokens',
        toolMode: 'native',
        reasoningMode: 'signature-required'
      }
    },
    {
      id: 'openai-responses-transcript-history',
      provider: createProviderRuntimeTestProvider({
        protocol: 'openai-responses',
        baseUrl: 'https://api.openai.com/v1',
        path: '/responses',
        model: 'gpt-5-mini',
        capabilities: {
          images: true,
          streaming: true,
          thinking: true
        }
      }),
      context: createProviderRuntimeTestContext({ withTools: true, withToolHistory: true }),
      advanced: createProviderRuntimeAdvanced({ maxTokens: '144', thinkingBudget: '2048' }),
      expected: {
        protocol: 'openai-responses',
        stream: true,
        outputTokenField: 'max_output_tokens',
        toolMode: 'transcript',
        reasoningMode: 'summary'
      }
    },
    {
      id: 'mimo-openai-compatible-token-field',
      provider: createProviderRuntimeTestProvider({
        protocol: 'openai-completions',
        baseUrl: 'https://api.xiaomimimo.com/v1',
        path: '/chat/completions',
        model: 'mimo-v2.5-pro',
        capabilities: {
          images: false,
          streaming: true,
          thinking: false
        }
      }),
      context: createProviderRuntimeTestContext({ withTools: false }),
      advanced: createProviderRuntimeAdvanced({ maxTokens: '48' }),
      expected: {
        protocol: 'openai-completions',
        stream: true,
        outputTokenField: 'max_completion_tokens',
        toolMode: 'none',
        reasoningMode: 'none'
      }
    }
  ];
}
