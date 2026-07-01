import type { OpenAiToolCallAccumulator, ReplyAccumulator } from './providerRuntimeReplyAccumulator';
import { mergeToolCallArgumentsText } from './providerRuntimeToolArguments';

function readObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function serializeToolInput(input: unknown) {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return Object.keys(input).length > 0 ? JSON.stringify(input) : '';
  }
  return '';
}

function readGeminiThoughtSignature(entry: Record<string, unknown>) {
  const extraContent = readObject(entry.extra_content) ?? readObject(entry.extraContent);
  const google = readObject(extraContent?.google);
  const signature =
    google?.thought_signature
    ?? google?.thoughtSignature
    ?? extraContent?.thought_signature
    ?? extraContent?.thoughtSignature;

  return typeof signature === 'string' && signature.trim() ? signature : undefined;
}

export function appendOpenAiToolCalls(target: ReplyAccumulator, toolCalls: unknown) {
  if (!Array.isArray(toolCalls)) return;
  const nextToolCalls = target.toolCalls ?? [];

  toolCalls.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;

    const parsed = entry as {
      index?: unknown;
      id?: unknown;
      function?: {
        name?: unknown;
        arguments?: unknown;
      };
    };

    const targetIndex =
      typeof parsed.index === 'number' && parsed.index >= 0
        ? parsed.index
        : index;
    const existing = nextToolCalls[targetIndex] ?? { argumentsText: '' };
    existing.sourceSpan ??= {
      transport: 'native',
      index: targetIndex
    };

    if (typeof parsed.id === 'string') {
      existing.id = parsed.id;
    }

    if (typeof parsed.function?.name === 'string') {
      existing.name = parsed.function.name;
    }

    if (typeof parsed.function?.arguments === 'string') {
      existing.argumentsText = mergeToolCallArgumentsText(existing.argumentsText, parsed.function.arguments);
    }

    const geminiThoughtSignature = readGeminiThoughtSignature(entry as Record<string, unknown>);
    if (geminiThoughtSignature) {
      existing.providerMetadata = {
        ...existing.providerMetadata,
        geminiThoughtSignature
      };
    }

    nextToolCalls[targetIndex] = existing;
  });

  target.toolCalls = nextToolCalls;
}

export function appendAnthropicToolCall(
  target: ReplyAccumulator,
  toolUse: {
    id?: unknown;
    name?: unknown;
    input?: unknown;
  }
) {
  if (typeof toolUse.name !== 'string' || !toolUse.name.trim()) return;
  const nextToolCalls = target.toolCalls ?? [];

  nextToolCalls.push({
    id: typeof toolUse.id === 'string' ? toolUse.id : '',
    name: toolUse.name,
    argumentsText: serializeToolInput(toolUse.input),
    sourceSpan: {
      transport: 'native',
      index: nextToolCalls.length
    }
  });

  target.toolCalls = nextToolCalls;
}
