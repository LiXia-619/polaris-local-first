import type { AssistantReply } from './providerRuntimeTypes';
import {
  extractProviderErrorMessage,
  formatProviderPayloadSnippet
} from './providerRuntimeErrorPayload';
import { toAssistantReply, type ReplyAccumulator } from './providerRuntimeReplyAccumulator';

function readObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function serializeGeminiFunctionArgs(args: unknown) {
  if (typeof args === 'string') return args;
  if (args && typeof args === 'object' && !Array.isArray(args)) {
    return Object.keys(args).length > 0 ? JSON.stringify(args) : '{}';
  }
  return '{}';
}

function appendGeminiCandidate(target: ReplyAccumulator, candidate: unknown) {
  const parsedCandidate = readObject(candidate);
  const content = readObject(parsedCandidate?.content);
  const parts = Array.isArray(content?.parts) ? content.parts : [];

  for (const part of parts) {
    const parsedPart = readObject(part);
    if (!parsedPart) continue;

    if (typeof parsedPart.text === 'string') {
      target.content += parsedPart.text;
    }

    const functionCall = readObject(parsedPart.functionCall);
    if (functionCall && typeof functionCall.name === 'string' && functionCall.name.trim()) {
      const nextToolCalls = target.toolCalls ?? [];
      const id = typeof functionCall.id === 'string'
        ? functionCall.id
        : `gemini-tool-call-${nextToolCalls.length + 1}`;
      const thoughtSignature =
        typeof parsedPart.thoughtSignature === 'string'
          ? parsedPart.thoughtSignature
          : typeof parsedPart.thought_signature === 'string'
            ? parsedPart.thought_signature
            : undefined;

      nextToolCalls.push({
        id,
        name: functionCall.name,
        argumentsText: serializeGeminiFunctionArgs(functionCall.args),
        providerMetadata: thoughtSignature ? { geminiThoughtSignature: thoughtSignature } : undefined,
        sourceSpan: {
          transport: 'native',
          index: nextToolCalls.length
        }
      });
      target.toolCalls = nextToolCalls;
    }
  }

  if (typeof parsedCandidate?.finishReason === 'string') {
    target.finishReason = parsedCandidate.finishReason.toLowerCase();
  }
}

export function extractGeminiNativeReply(data: unknown, fallbackModel: string): AssistantReply {
  const providerErrorMessage = extractProviderErrorMessage(data);
  if (providerErrorMessage) {
    throw new Error(providerErrorMessage);
  }

  const parsed = readObject(data);
  const usage = readObject(parsed?.usageMetadata);
  const collected: ReplyAccumulator = {
    content: '',
    thinkingText: '',
    model: typeof parsed?.modelVersion === 'string' ? parsed.modelVersion : fallbackModel,
    tokenCount: readNumber(usage?.totalTokenCount),
    tokenUsage: {
      totalTokens: readNumber(usage?.totalTokenCount),
      inputTokens: readNumber(usage?.promptTokenCount),
      outputTokens: readNumber(usage?.candidatesTokenCount),
      reasoningTokens: readNumber(usage?.thoughtsTokenCount)
    },
    toolCalls: []
  };

  const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  candidates.forEach((candidate) => appendGeminiCandidate(collected, candidate));

  if (!collected.content.trim() && !collected.thinkingText.trim() && !(collected.toolCalls?.length ?? 0)) {
    const rawSnippet = formatProviderPayloadSnippet(data);
    throw new Error(rawSnippet ? `API 返回为空：${rawSnippet}` : 'API 返回为空');
  }

  return toAssistantReply(collected, fallbackModel, {
    allowThinkingFallbackInContent: (collected.toolCalls?.length ?? 0) === 0
  });
}
