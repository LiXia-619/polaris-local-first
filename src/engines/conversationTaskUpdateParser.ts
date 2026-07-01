import type {
  ConversationTaskStatus,
  ConversationTaskStepStatus
} from '../types/domain';
import type { ConversationTaskUpdateInput } from './conversationTask';

function createTaskBlockPattern() {
  return /```polaris-task\s*([\s\S]*?)```/g;
}

function createTaskBlockTailPattern() {
  return /```polaris-task[\s\S]*$/;
}

function normalizeTaskText(value: string | undefined | null) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || '';
}

function isConversationTaskStatus(value: string): value is ConversationTaskStatus {
  return value === 'running' || value === 'blocked' || value === 'completed' || value === 'cancelled';
}

function isConversationTaskStepStatus(value: string): value is ConversationTaskStepStatus {
  return value === 'pending' || value === 'in_progress' || value === 'completed' || value === 'blocked';
}

function parseConversationTaskUpdate(raw: unknown): ConversationTaskUpdateInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const value = raw as Record<string, unknown>;
  const title = normalizeTaskText(typeof value.title === 'string' ? value.title : '');
  const stage = normalizeTaskText(typeof value.stage === 'string' ? value.stage : '');
  if (!title || !stage) return null;

  const statusValue = typeof value.status === 'string' ? value.status : '';
  if (!isConversationTaskStatus(statusValue)) return null;

  const steps = Array.isArray(value.steps)
    ? value.steps.map((step) => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) return null;
      const stepValue = step as Record<string, unknown>;
      const stepTitle = normalizeTaskText(typeof stepValue.title === 'string' ? stepValue.title : '');
      const stepStatus = typeof stepValue.status === 'string' ? stepValue.status : '';
      if (!stepTitle || !isConversationTaskStepStatus(stepStatus)) return null;

      return {
        id: normalizeTaskText(typeof stepValue.id === 'string' ? stepValue.id : '') || undefined,
        title: stepTitle,
        status: stepStatus,
        detail: normalizeTaskText(typeof stepValue.detail === 'string' ? stepValue.detail : '') || undefined
      };
    }).filter((step): step is NonNullable<typeof step> => Boolean(step))
    : [];

  return {
    id: normalizeTaskText(typeof value.id === 'string' ? value.id : '') || undefined,
    title,
    status: statusValue,
    stage,
    summary: normalizeTaskText(typeof value.summary === 'string' ? value.summary : '') || undefined,
    focus: normalizeTaskText(typeof value.focus === 'string' ? value.focus : '') || undefined,
    next: normalizeTaskText(typeof value.next === 'string' ? value.next : '') || undefined,
    steps
  };
}

export function stripTaskBlocksFromReply(content: string) {
  return content
    .replace(createTaskBlockPattern(), '')
    .replace(createTaskBlockTailPattern(), '')
    .trim();
}

export function parseAssistantTaskUpdate(content: string) {
  const matches = [...content.matchAll(createTaskBlockPattern())];
  const rawBlock = matches.length > 0 ? matches[matches.length - 1]?.[1] : undefined;

  if (!rawBlock) {
    return {
      displayContent: stripTaskBlocksFromReply(content),
      taskUpdate: null
    };
  }

  try {
    const parsed = JSON.parse(rawBlock);
    return {
      displayContent: stripTaskBlocksFromReply(content),
      taskUpdate: parseConversationTaskUpdate(parsed)
    };
  } catch {
    return {
      displayContent: stripTaskBlocksFromReply(content),
      taskUpdate: null
    };
  }
}
