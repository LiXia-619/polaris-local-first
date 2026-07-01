import type { AssistantToolActionMcpParseContext } from './assistantToolProtocolActionMcp';

export type AssistantToolActionParseContext = AssistantToolActionMcpParseContext & {
  activeProjectId?: string | null;
};
