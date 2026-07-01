import type { Conversation, ToolInvocation } from '../../types/domain';
import { splitFencedCode, type FencedCodeBlock } from './groupMessageCode';
import { laneWhisperEntries } from './groupRequestModel';
import { oneLine, stripInlineMarkup } from './groupText';

export type GroupLaneToolEvent = {
  id: string;
  title: string;
  summary: string;
  status: ToolInvocation['status'];
  toolName?: string;
};

export type GroupLaneRecallItem = {
  id: string;
  label: string;
  excerpt: string;
};

export type GroupLaneEntry = {
  messageId: string;
  timestamp: number;
  publicExcerpt: string;
  thinkingText: string | null;
  codeBlocks: FencedCodeBlock[];
  memoryRecall: GroupLaneRecallItem[];
  toolEvents: GroupLaneToolEvent[];
  failed: boolean;
};

export type GroupLaneItem =
  | {
      type: 'whisper';
      id: string;
      author: 'user' | 'collaborator';
      content: string;
      timestamp: number;
    }
  | {
      type: 'process';
      id: string;
      timestamp: number;
      publicExcerpt: string;
      thinkingText: string | null;
      codeBlocks: FencedCodeBlock[];
      memoryRecall: GroupLaneRecallItem[];
      toolEvents: GroupLaneToolEvent[];
    };

export function buildGroupLaneEntries(conversation: Conversation | null, memberId: string): GroupLaneEntry[] {
  if (!conversation) return [];
  const ledger = conversation.toolLedger ?? [];
  return conversation.messages
    .filter((message) =>
      message.speakerCollaboratorId === memberId
      && (message.role === 'assistant' || message.origin === 'tool-runtime'))
    .map((message) => {
      const toolEvents: GroupLaneToolEvent[] = [];
      if (message.toolInvocation) {
        toolEvents.push({
          id: message.toolInvocation.id,
          title: message.toolInvocation.title,
          summary: message.toolInvocation.summary,
          status: message.toolInvocation.status,
          toolName: message.toolInvocation.toolName
        });
      }
      for (const entry of ledger) {
        if (entry.assistantMessageId !== message.id) continue;
        toolEvents.push({
          id: entry.id,
          title: entry.resultToolName ?? entry.toolName,
          summary: entry.argumentsText.length > 120 ? `${entry.argumentsText.slice(0, 120)}…` : entry.argumentsText,
          status: entry.resultStatus ?? 'executed',
          toolName: entry.toolName
        });
      }
      const { text, codeBlocks } = splitFencedCode(message.content);
      const memoryRecall: GroupLaneRecallItem[] = (message.memoryEvidence?.items ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        excerpt: oneLine(item.textExcerpt)
      }));
      return {
        messageId: message.id,
        timestamp: message.timestamp,
        publicExcerpt: oneLine(stripInlineMarkup(text || message.content)),
        thinkingText: message.thinkingText?.trim() ? message.thinkingText : null,
        codeBlocks,
        memoryRecall,
        toolEvents,
        failed: message.toolInvocation?.status === 'failed'
      };
    })
    .reverse();
}

export function buildGroupLaneTimeline(conversation: Conversation | null, memberId: string): GroupLaneItem[] {
  const processItems: GroupLaneItem[] = buildGroupLaneEntries(conversation, memberId).map((entry) => ({
    type: 'process',
    id: `process-${entry.messageId}`,
    timestamp: entry.timestamp,
    publicExcerpt: entry.publicExcerpt,
    thinkingText: entry.thinkingText,
    codeBlocks: entry.codeBlocks,
    memoryRecall: entry.memoryRecall,
    toolEvents: entry.toolEvents
  }));
  const whisperItems: GroupLaneItem[] = laneWhisperEntries(conversation, memberId).map((entry) => ({
    type: 'whisper',
    id: entry.id,
    author: entry.author === 'user' ? 'user' : 'collaborator',
    content: entry.content,
    timestamp: entry.createdAt
  }));
  return [...processItems, ...whisperItems].sort((a, b) => a.timestamp - b.timestamp);
}
