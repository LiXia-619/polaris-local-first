import { projectToolResultPayloadForRequest } from '../../request/requestToolResultProjection';
import { extractTextPayload } from './messages';
import type { OrderedContextMessage } from './types';

export function buildToolResultPayloadText(
  message: OrderedContextMessage,
  overrides?: {
    toolName?: string;
    kind?: string;
  }
) {
  if (!message.toolResult) {
    return extractTextPayload(message.content).trim();
  }

  return JSON.stringify(projectToolResultPayloadForRequest({
    toolName: overrides?.toolName ?? message.toolResult.toolName,
    status: message.toolResult.status,
    sourceMessageId: message.toolResult.sourceMessageId,
    isError: message.toolResult.isError,
    ...message.toolResult.structuredPayload
  }, overrides));
}

export function parseToolCallArguments(argumentsText: string) {
  try {
    const parsed = JSON.parse(argumentsText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep the raw string below when the provider returned non-object arguments.
  }

  return { raw: argumentsText };
}
