import type { ConversationTaskExecution, ToolLedgerEntry } from '../types/domain';

export type ConversationTaskExecutionOutcomeInput = {
  path: string;
  proposalId?: string;
};

function uniqueNonEmpty(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim() || '').filter(Boolean))];
}

export function buildConversationTaskExecution(args: {
  assistantMessageId: string;
  toolLedger: ToolLedgerEntry[] | undefined;
  outcomes: ConversationTaskExecutionOutcomeInput[];
  updatedAt?: number;
}): ConversationTaskExecution | null {
  const assistantMessageId = args.assistantMessageId.trim();
  if (!assistantMessageId) return null;

  const toolLedgerEntries = (args.toolLedger ?? []).filter((entry) => entry.assistantMessageId === assistantMessageId);
  const resultMessageIds = uniqueNonEmpty(toolLedgerEntries.map((entry) => entry.resultMessageId));
  const toolCallIds = uniqueNonEmpty(toolLedgerEntries.map((entry) => entry.toolCallId));
  const pendingProposalIds = uniqueNonEmpty(
    args.outcomes.map((outcome) => outcome.path === 'workspace' ? outcome.proposalId : undefined)
  );

  if (toolCallIds.length === 0 && resultMessageIds.length === 0 && pendingProposalIds.length === 0) {
    return null;
  }

  return {
    id: assistantMessageId,
    assistantMessageId,
    toolCallIds,
    resultMessageIds,
    pendingProposalIds,
    updatedAt: args.updatedAt ?? Date.now()
  };
}
