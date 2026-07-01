import type { ChatMessage, ConversationTaskState } from '../types/domain';
import { normalizePromptInlineText, summarizePromptInlineText } from './promptFormatting';

export type ConversationTaskWorkbenchEvidenceMessage = ChatMessage & {
  toolInvocation: NonNullable<ChatMessage['toolInvocation']>;
};

export type ConversationTaskWorkbenchExecutionSegment = {
  id: string;
  note?: string;
  messages: ConversationTaskWorkbenchEvidenceMessage[];
  hasPendingWorkspaceProposal: boolean;
};

export type ConversationTaskWorkbench = {
  lines: string[];
  executionSegments: ConversationTaskWorkbenchExecutionSegment[];
};

function normalizeWorkbenchText(value: string | undefined | null) {
  return normalizePromptInlineText(value);
}

function summarizeWorkbenchText(value: string | undefined | null, maxLength: number) {
  return summarizePromptInlineText(value, maxLength);
}

function summarizeExecutionMessage(message: ChatMessage | undefined) {
  const tool = message?.toolInvocation;
  if (!tool) return '';
  const title = normalizeWorkbenchText(tool.title);
  const summary = summarizeWorkbenchText(tool.summary, 56);
  if (!title) return summary;
  if (!summary || summary === title) return title;
  if (summary.startsWith(`${title} ·`)) return summary;
  return `${title} · ${summary}`;
}

function summarizeExecutionNote(message: ChatMessage | undefined) {
  return summarizeWorkbenchText(message?.content, 72);
}

export function buildConversationTaskWorkbench(args: {
  currentTask: ConversationTaskState;
  messages: ChatMessage[];
}): ConversationTaskWorkbench {
  const { currentTask, messages } = args;
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const executionSegments = [...currentTask.executions]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map<ConversationTaskWorkbenchExecutionSegment>((execution) => {
      const segmentMessages = execution.resultMessageIds
        .map((messageId) => messagesById.get(messageId) ?? null)
        .filter((message): message is ChatMessage => Boolean(message))
        .filter((message): message is ConversationTaskWorkbenchEvidenceMessage => Boolean(message.toolInvocation))
        .slice(-4)
        .reverse();

      return {
        id: execution.id,
        note: summarizeExecutionNote(messagesById.get(execution.assistantMessageId)),
        messages: segmentMessages,
        hasPendingWorkspaceProposal: execution.pendingProposalIds.length > 0
      };
    })
    .filter((segment) => segment.messages.length > 0 || segment.hasPendingWorkspaceProposal);

  const lines = [
    `当前目标：${summarizeWorkbenchText(currentTask.goal, 100) || summarizeWorkbenchText(currentTask.title, 100)}`,
    `当前阶段：${summarizeWorkbenchText(currentTask.stage, 80)}`
  ];

  executionSegments.slice(0, 2).forEach((segment, index) => {
    const resultSummaries = segment.messages
      .map((message) => summarizeExecutionMessage(message))
      .filter(Boolean)
      .slice(0, 3);
    const segmentLabel = index === 0 ? '最近一段' : '上一段';

    if (segment.note) {
      lines.push(`${segmentLabel}你自己刚说过：${segment.note}`);
    }
    if (resultSummaries.length > 0) {
      lines.push(`${segmentLabel}已经落下：${resultSummaries.join('；')}`);
    }
    if (segment.hasPendingWorkspaceProposal) {
      lines.push(`${segmentLabel}这一步碰到了待确认的工作区边界。`);
    }
  });

  if (currentTask.focus) {
    lines.push(`你现在正埋头在：${summarizeWorkbenchText(currentTask.focus, 72)}`);
  }
  if (currentTask.next) {
    lines.push(`你等下准备：${summarizeWorkbenchText(currentTask.next, 72)}`);
  }

  return {
    lines,
    executionSegments
  };
}
