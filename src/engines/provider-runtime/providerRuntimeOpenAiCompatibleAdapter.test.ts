import { describe, expect, it } from 'vitest';
import {
  buildOpenAiCompatibleRequest,
  openAiCompatibleChatAdapter
} from './providerRuntimeOpenAiCompatibleAdapter';
import {
  resolveProviderRuntimeRequestAdapter
} from './providerRuntimeAdapters';
import {
  createProviderRuntimeAdvanced,
  createProviderRuntimeTestContext,
  createProviderRuntimeTestProvider
} from './providerRuntimeFixtures';
import { resolveCanonicalProviderCapabilities } from './providerRuntimeCapabilities';
import type { ProviderRuntimeRequestInput } from './providerRuntimeRequestTypes';

type OpenAiCompatibleAdapterParityCase = {
  id: string;
  input: ProviderRuntimeRequestInput;
  verify(request: ReturnType<typeof buildOpenAiCompatibleRequest>): void;
  verifyCapabilities?: unknown;
};

function firstAssistantMessage(request: ReturnType<typeof buildOpenAiCompatibleRequest>) {
  const messages = request.body.messages;
  if (!Array.isArray(messages)) return {};
  return messages.find((message) =>
    message && typeof message === 'object' && (message as { role?: unknown }).role === 'assistant'
  ) as Record<string, unknown> | undefined;
}

function createContextWithThinkingHistory() {
  const context = createProviderRuntimeTestContext({ withTools: true, withToolHistory: true });
  const firstMessage = context.segments[0]?.messages.find((message) => message.role === 'assistant');
  if (firstMessage?.role === 'assistant') {
    firstMessage.thinkingText = 'Adapter parity fixture reasoning.';
  }
  return context;
}

function createContextWithMultipleSystemLayers() {
  const context = createProviderRuntimeTestContext({ withSystem: false, withTools: false });
  context.segments.unshift({
    kind: 'system',
    messages: [{
      role: 'system',
      content: 'System layer A.'
    }]
  });
  context.segments.unshift({
    kind: 'system',
    messages: [{
      role: 'system',
      content: 'System layer B.'
    }]
  });
  return context;
}

function createContextWithStableAndVolatileSystemLayers() {
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
    segments: [
      {
        kind: 'system' as const,
        messages: [{
          role: 'system' as const,
          content: 'Stable identity.',
          promptPartLayer: 'identity' as const,
          promptPartName: 'system_identity' as const
        }]
      },
      {
        kind: 'system' as const,
        messages: [{
          role: 'system' as const,
          content: 'Current model runtime hint.',
          promptPartLayer: 'context' as const,
          promptPartName: 'model_runtime_context' as const
        }]
      },
      {
        kind: 'memory' as const,
        messages: [{
          role: 'system' as const,
          content: 'Stable memory lane.',
          cachePrefixEligible: true
        }]
      },
      {
        kind: 'semantic_recall' as const,
        messages: [{
          role: 'system' as const,
          content: 'Volatile semantic recall.',
          promptPartLayer: 'context' as const
        }]
      },
      {
        kind: 'conversation' as const,
        messages: [{
          role: 'system' as const,
          content: 'Append-only system feedback should not become a stable prefix.'
        }]
      },
      {
        kind: 'conversation' as const,
        messages: [
          {
            role: 'user' as const,
            content: 'Earlier turn.'
          },
          {
            role: 'assistant' as const,
            content: 'Earlier answer.'
          },
          {
            role: 'user' as const,
            content: 'Latest turn.'
          }
        ]
      }
    ]
  };
}

const parityCases: OpenAiCompatibleAdapterParityCase[] = [
  {
    id: 'openai-direct-required-tool-choice',
    input: {
      api: createProviderRuntimeTestProvider({
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
      advanced: createProviderRuntimeAdvanced({ maxTokens: '128', temperature: '0.7' })
    },
    verify(request) {
      expect(request.provider).toBe('openai-completions');
      expect(request.body.tool_choice).toBe('required');
      expect(request.body.max_tokens).toBe(128);
      expect(request.body.temperature).toBe(0.7);
      expect(request.body.stream).toBe(true);
    },
    verifyCapabilities: expect.objectContaining({
      input: expect.objectContaining({ images: 'data-url' }),
      tools: expect.objectContaining({ mode: 'native', choiceControl: 'required' }),
      budgets: expect.objectContaining({ outputTokenField: 'max_tokens', promptBudgetPolicy: 'enforced' })
    })
  },
  {
    id: 'deepseek-reasoner-omits-tool-choice',
    input: {
      api: createProviderRuntimeTestProvider({
        baseUrl: 'https://api.deepseek.com/v1',
        path: '/chat/completions',
        model: 'deepseek-reasoner',
        capabilities: {
          images: false,
          streaming: true,
          thinking: true
        }
      }),
      context: createProviderRuntimeTestContext({ withTools: true, toolChoice: 'required' }),
      advanced: createProviderRuntimeAdvanced({ thinkingBudget: '1024' })
    },
    verify(request) {
      expect(request.body.tools).toBeDefined();
      expect(request.body).not.toHaveProperty('tool_choice');
      expect(request.body.thinking).toBeUndefined();
    },
    verifyCapabilities: expect.objectContaining({
      input: expect.objectContaining({ images: 'none' }),
      output: expect.objectContaining({ reasoning: 'text' }),
      tools: expect.objectContaining({ mode: 'native', choiceControl: 'none', requiredChoice: false }),
      budgets: expect.objectContaining({ promptBudgetPolicy: 'advisory', reasoningBudget: false })
    })
  },
  {
    id: 'deepseek-omits-volatile-system-layers-for-prefix-cache',
    input: {
      api: createProviderRuntimeTestProvider({
        baseUrl: 'https://api.deepseek.com/v1',
        path: '/chat/completions',
        model: 'deepseek-chat',
        capabilities: {
          images: false,
          streaming: true,
          thinking: false
        }
      }),
      context: createContextWithStableAndVolatileSystemLayers(),
      advanced: createProviderRuntimeAdvanced()
    },
    verify(request) {
      expect(request.body.messages).toEqual([
        expect.objectContaining({ role: 'system', content: 'Stable identity.' }),
        expect.objectContaining({ role: 'system', content: 'Stable memory lane.' }),
        expect.objectContaining({ role: 'user', content: 'Earlier turn.' }),
        expect.objectContaining({ role: 'assistant', content: 'Earlier answer.' }),
        expect.objectContaining({ role: 'user', content: 'Latest turn.' }),
        expect.objectContaining({ role: 'system', content: 'Volatile semantic recall.' })
      ]);
      expect(request.body.messages).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ content: 'Append-only system feedback should not become a stable prefix.' })
      ]));
    }
  },
  {
    id: 'openai-compatible-defers-volatile-system-layers-without-omitting-them',
    input: {
      api: createProviderRuntimeTestProvider({
        baseUrl: 'https://api.openai.com/v1',
        path: '/chat/completions',
        model: 'gpt-5-mini',
        capabilities: {
          images: false,
          streaming: true,
          thinking: false
        }
      }),
      context: createContextWithStableAndVolatileSystemLayers(),
      advanced: createProviderRuntimeAdvanced()
    },
    verify(request) {
      expect(request.body.messages).toEqual([
        expect.objectContaining({ role: 'system', content: 'Stable identity.' }),
        expect.objectContaining({ role: 'system', content: 'Stable memory lane.' }),
        expect.objectContaining({ role: 'user', content: 'Earlier turn.' }),
        expect.objectContaining({ role: 'assistant', content: 'Earlier answer.' }),
        expect.objectContaining({ role: 'user', content: 'Latest turn.' }),
        expect.objectContaining({ role: 'system', content: 'Current model runtime hint.' }),
        expect.objectContaining({ role: 'system', content: 'Volatile semantic recall.' }),
        expect.objectContaining({ role: 'system', content: 'Append-only system feedback should not become a stable prefix.' })
      ]);
    },
    verifyCapabilities: expect.objectContaining({
      cache: expect.objectContaining({ mode: 'automatic-or-unknown' })
    })
  },
  {
    id: 'siliconflow-tool-calls-disable-streaming',
    input: {
      api: createProviderRuntimeTestProvider({
        baseUrl: 'https://api.siliconflow.cn/v1',
        path: '/chat/completions',
        model: 'moonshotai/Kimi-K2-Instruct',
        capabilities: {
          images: false,
          streaming: true,
          thinking: false
        }
      }),
      context: createProviderRuntimeTestContext({ withTools: true, toolChoice: 'required' })
    },
    verify(request) {
      expect(request.body.tools).toBeDefined();
      expect(request.body.tool_choice).toBe('auto');
      expect(request.body.stream).toBeUndefined();
    },
    verifyCapabilities: expect.objectContaining({
      tools: expect.objectContaining({ mode: 'native', choiceControl: 'auto' }),
      budgets: expect.objectContaining({ promptBudgetPolicy: 'advisory' })
    })
  },
  {
    id: 'moonshot-kimi-k2-omits-temperature-and-thinking-budget',
    input: {
      api: createProviderRuntimeTestProvider({
        baseUrl: 'https://api.moonshot.cn/v1',
        path: '/chat/completions',
        model: 'kimi-k2.6',
        capabilities: {
          images: false,
          streaming: true,
          thinking: true
        }
      }),
      context: createProviderRuntimeTestContext({ withTools: true, toolChoice: 'required' }),
      advanced: createProviderRuntimeAdvanced({ temperature: '0.7', thinkingBudget: '1024' })
    },
    verify(request) {
      expect(request.body.stream).toBe(true);
      expect(request.body.stream_options).toEqual({ include_usage: true });
      expect(request.body.tool_choice).toBe('auto');
      expect(request.body.temperature).toBeUndefined();
      expect(request.body.thinking).toBeUndefined();
    },
    verifyCapabilities: expect.objectContaining({
      tools: expect.objectContaining({ mode: 'native', choiceControl: 'auto' }),
      budgets: expect.objectContaining({ promptBudgetPolicy: 'advisory', reasoningBudget: false })
    })
  },
  {
    id: 'mimo-token-field-and-reasoning-history',
    input: {
      api: createProviderRuntimeTestProvider({
        baseUrl: 'https://api.xiaomimimo.com/v1',
        path: '/chat/completions',
        model: 'mimo-v2.5-pro',
        capabilities: {
          images: false,
          streaming: true,
          thinking: true
        }
      }),
      context: createContextWithThinkingHistory(),
      advanced: createProviderRuntimeAdvanced({ maxTokens: '48' })
    },
    verify(request) {
      expect(request.body.max_completion_tokens).toBe(48);
      expect(request.body.max_tokens).toBeUndefined();
      expect(firstAssistantMessage(request)).toEqual(expect.objectContaining({
        reasoning_content: 'Adapter parity fixture reasoning.'
      }));
    },
    verifyCapabilities: expect.objectContaining({
      output: expect.objectContaining({ reasoning: 'text' }),
      cache: { mode: 'automatic-or-unknown', promptCaching: true },
      transport: expect.objectContaining({ modes: expect.arrayContaining(['direct']) }),
      budgets: expect.objectContaining({ outputTokenField: 'max_completion_tokens', promptBudgetPolicy: 'advisory' })
    })
  }
];

describe('openAiCompatibleChatAdapter', () => {
  it('matches only OpenAI-compatible chat completion providers', () => {
    for (const testCase of parityCases) {
      expect(resolveProviderRuntimeRequestAdapter(testCase.input.api).id, testCase.id)
        .toBe(openAiCompatibleChatAdapter.id);
      expect(openAiCompatibleChatAdapter.match(testCase.input.api)).toEqual({
        adapterId: 'openai-compatible-chat',
        confidence: 'exact',
        reason: 'matched provider protocol: openai-completions'
      });
    }
  });

  it('preserves legacy OpenAI-compatible request output exactly', () => {
    for (const testCase of parityCases) {
      const adapterRequest = openAiCompatibleChatAdapter.buildRequest(testCase.input);
      const directRequest = buildOpenAiCompatibleRequest(testCase.input);

      expect(adapterRequest, testCase.id).toEqual(directRequest);
      testCase.verify(adapterRequest);
    }
  });

  it('archives OpenAI-compatible capability quirks beside adapter parity fixtures', () => {
    for (const testCase of parityCases) {
      if (!testCase.verifyCapabilities) continue;
      expect(
        resolveCanonicalProviderCapabilities(testCase.input.api, testCase.input.advanced),
        testCase.id
      ).toEqual(testCase.verifyCapabilities);
    }
  });

  it('does not send temperature after the user clears the sampling value', () => {
    const request = buildOpenAiCompatibleRequest({
      api: createProviderRuntimeTestProvider(),
      context: createProviderRuntimeTestContext(),
      advanced: createProviderRuntimeAdvanced({ temperature: '' })
    });

    expect(request.body.temperature).toBeUndefined();
  });

  it('collapses multiple system layers for SenseNova chat completions', () => {
    const request = buildOpenAiCompatibleRequest({
      api: createProviderRuntimeTestProvider({
        baseUrl: 'https://token.sensenova.cn/v1',
        path: '/chat/completions',
        model: 'sensenova-6.7-flash-lite',
        capabilities: {
          images: false,
          streaming: true,
          thinking: false
        }
      }),
      context: createContextWithMultipleSystemLayers()
    });

    expect(request.body.messages).toEqual([
      {
        role: 'system',
        content: 'System layer B.\n\nSystem layer A.'
      },
      {
        role: 'user',
        content: 'Please answer with a small provider runtime fixture.'
      }
    ]);
  });

  it('collapses multiple system layers for MiniMax M2 OpenAI-compatible chat completions', () => {
    const request = buildOpenAiCompatibleRequest({
      api: createProviderRuntimeTestProvider({
        baseUrl: 'https://api.minimax.io/v1',
        path: '/chat/completions',
        model: 'minimax/minimax-m2.5-highspeed',
        capabilities: {
          images: false,
          streaming: true,
          thinking: false
        }
      }),
      context: createContextWithMultipleSystemLayers()
    });

    expect(request.body.messages).toEqual([
      {
        role: 'system',
        content: 'System layer B.\n\nSystem layer A.'
      },
      {
        role: 'user',
        content: 'Please answer with a small provider runtime fixture.'
      }
    ]);
  });
});
