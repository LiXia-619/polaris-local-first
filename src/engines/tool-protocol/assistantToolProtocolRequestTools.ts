import type {
  AssistantRequestTool,
  AssistantRequestToolChoice
} from '../request/requestContext';
import type { AssistantToolContext } from './assistantToolProtocolTypes';
import { resolveToolCapabilityReceipt } from './toolCapabilityReceipt';

export function resolveAssistantToolRequestTools(
  context?: AssistantToolContext
): {
  tools: AssistantRequestTool[];
  toolChoice?: AssistantRequestToolChoice;
} {
  const tools: AssistantRequestTool[] = resolveToolCapabilityReceipt(context).nativeTools
    .map((tool) => ({
      type: 'function',
      function: tool.schema
    }));

  return {
    tools,
    toolChoice: tools.length > 0 ? 'auto' : undefined
  };
}
