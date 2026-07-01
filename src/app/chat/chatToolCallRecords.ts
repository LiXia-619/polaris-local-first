import type { AssistantToolAction } from '../../engines/assistantToolProtocol';
import type { AssistantNativeToolCall } from '../../engines/chatApi';
import { normalizeChatNativeToolCalls } from '../../engines/chatMessageNormalization';
import type { ChatMessage } from '../../types/domain';

function serializeActionArguments(action: AssistantToolAction) {
  const payload = { ...action } as Record<string, unknown>;
  delete payload.kind;
  return JSON.stringify(payload);
}

export function buildStoredToolCallRecords(args: {
  assistantMessageId: string;
  content: string;
  actions: AssistantToolAction[];
  nativeToolCalls: AssistantNativeToolCall[];
}): ChatMessage['nativeToolCalls'] {
  if (args.nativeToolCalls.length > 0) {
    return normalizeChatNativeToolCalls(args.assistantMessageId, args.nativeToolCalls);
  }

  if (args.actions.length === 0) {
    return undefined;
  }

  const syntheticTransport =
    args.content.includes('```polaris-tools')
      ? 'fence'
      : 'recovered-code';

  return args.actions.map((action, index) => ({
    id: `${args.assistantMessageId}:tool-call:${index + 1}`,
    name: action.kind,
    argumentsText: serializeActionArguments(action),
    sourceSpan: {
      transport: syntheticTransport,
      index
    }
  }));
}
