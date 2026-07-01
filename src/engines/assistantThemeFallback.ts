import type { AssistantToolAction } from './assistantToolProtocol';

export function extractAssistantThemeFallback(content: string): {
  action: AssistantToolAction | null;
  displayContent: string;
} {
  return {
    action: null,
    displayContent: content
  };
}
