import { normalizeChatNativeToolCalls } from './chatMessageNormalization';
import type { ChatMessage, ToolInvocation, ToolLedgerEntry } from '../types/domain';

type ToolLedgerSourceMessage = Pick<ChatMessage, 'id' | 'role' | 'nativeToolCalls' | 'toolInvocation'>;

function trimString(value: string | undefined) {
  return value?.trim() || null;
}

function buildToolResultStructuredPayload(toolInvocation: ToolInvocation) {
  return {
    kind: toolInvocation.kind,
    status: toolInvocation.status,
    title: toolInvocation.title,
    summary: toolInvocation.summary,
    detailText: toolInvocation.detailText,
    scope: toolInvocation.themeScope,
    surfaces: toolInvocation.themeSurfaceLabels,
    intent: toolInvocation.themeIntentLabel,
    previewId: toolInvocation.previewId,
    presetId: toolInvocation.presetId,
    world: toolInvocation.world,
    cardId: toolInvocation.cardId,
    projectFileId: toolInvocation.projectFileId,
    projectFileIds: toolInvocation.projectFileIds,
    projectFilePaths: toolInvocation.projectFilePaths,
    projectFiles: toolInvocation.projectFiles,
    projectFileReads: toolInvocation.projectFileReads,
    projectFileEffects: toolInvocation.projectFileEffects,
    projectDiagnostics: toolInvocation.projectDiagnostics,
    imageCardId: toolInvocation.imageCardId,
    memoryItems: toolInvocation.memoryItems,
    webSearch: toolInvocation.webSearch,
    webPageRead: toolInvocation.webPageRead,
    mcpResult: toolInvocation.mcpResult,
    targetLabel: toolInvocation.targetLabel,
    error: toolInvocation.error
  };
}

function findPendingToolLedgerEntry(args: {
  toolInvocation: ToolInvocation;
  pendingEntriesByAssistantMessageId: Map<string, ToolLedgerEntry[]>;
}) {
  const sourceMessageId = trimString(args.toolInvocation.originMessageId);
  if (!sourceMessageId) {
    return null;
  }

  const candidates = args.pendingEntriesByAssistantMessageId.get(sourceMessageId) ?? [];
  if (candidates.length === 0) {
    return null;
  }

  const exactToolName = args.toolInvocation.toolName ?? args.toolInvocation.kind;
  const exactMatch = candidates.find((entry) => entry.toolName === exactToolName) ?? null;
  if (exactMatch) {
    return exactMatch;
  }

  return candidates[0] ?? null;
}

function consumePendingToolLedgerEntry(
  pendingEntriesByAssistantMessageId: Map<string, ToolLedgerEntry[]>,
  entry: ToolLedgerEntry
) {
  const pendingEntries = pendingEntriesByAssistantMessageId.get(entry.assistantMessageId);
  if (!pendingEntries) {
    return;
  }

  const nextPendingEntries = pendingEntries.filter((candidate) => candidate.id !== entry.id);
  if (nextPendingEntries.length === 0) {
    pendingEntriesByAssistantMessageId.delete(entry.assistantMessageId);
    return;
  }

  pendingEntriesByAssistantMessageId.set(entry.assistantMessageId, nextPendingEntries);
}

export function rebuildConversationToolLedger(messages: ToolLedgerSourceMessage[]) {
  const entries: ToolLedgerEntry[] = [];
  const entriesByToolCallId = new Map<string, ToolLedgerEntry>();
  const pendingEntriesByAssistantMessageId = new Map<string, ToolLedgerEntry[]>();

  for (const message of messages) {
    if (message.role === 'assistant') {
      const toolCalls = normalizeChatNativeToolCalls(message.id, message.nativeToolCalls) ?? [];
      if (toolCalls.length > 0) {
        const ledgerEntries = toolCalls
          .map((toolCall, index) => {
            const toolCallId = trimString(toolCall.id);
            if (!toolCallId) {
              return null;
            }

            const entry: ToolLedgerEntry = {
              id: `${message.id}:tool-ledger:${index + 1}`,
              toolCallId,
              assistantMessageId: message.id,
              order: index,
              toolName: toolCall.name,
              argumentsText: toolCall.argumentsText,
              sourceSpan: toolCall.sourceSpan,
              ...(toolCall.providerMetadata ? { providerMetadata: toolCall.providerMetadata } : {})
            };
            entriesByToolCallId.set(toolCallId, entry);
            return entry;
          })
          .filter((entry): entry is ToolLedgerEntry => entry !== null);

        if (ledgerEntries.length > 0) {
          entries.push(...ledgerEntries);
          pendingEntriesByAssistantMessageId.set(message.id, ledgerEntries);
        }
      }
    }

    const toolInvocation = message.toolInvocation;
    if (!toolInvocation) {
      continue;
    }

    const explicitToolCallId = trimString(toolInvocation.toolCallId);
    const resolvedEntry =
      (explicitToolCallId ? entriesByToolCallId.get(explicitToolCallId) ?? null : null)
      ?? findPendingToolLedgerEntry({
        toolInvocation,
        pendingEntriesByAssistantMessageId
      });

    if (!resolvedEntry) {
      continue;
    }

    resolvedEntry.resultMessageId = message.id;
    resolvedEntry.resultToolName = toolInvocation.toolName ?? toolInvocation.kind;
    resolvedEntry.resultStatus = toolInvocation.status;
    resolvedEntry.resultIsError = toolInvocation.status === 'failed';
    resolvedEntry.resultSourceMessageId = toolInvocation.originMessageId;
    resolvedEntry.resultStructuredPayload = buildToolResultStructuredPayload(toolInvocation);
    consumePendingToolLedgerEntry(pendingEntriesByAssistantMessageId, resolvedEntry);
  }

  return entries.length > 0 ? entries : undefined;
}
