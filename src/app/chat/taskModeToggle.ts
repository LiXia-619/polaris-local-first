import { isConversationTaskTerminal, resolveConversationTaskMode } from '../../engines/conversationTask';
import type { ConversationTaskState } from '../../types/domain';

type TaskModeTogglePorts = {
  runtime: {
    setTaskModeEnabled: (enabled: boolean) => void;
  };
  chat: {
    conversations: Array<{
      id: string;
      task?: ConversationTaskState | null;
    }>;
    setConversationTask: (conversationId: string, task: ConversationTaskState | null) => void;
  };
};

export function setTaskModeEnabledForConversations(
  ports: TaskModeTogglePorts,
  enabled: boolean
) {
  ports.runtime.setTaskModeEnabled(enabled);
  if (enabled) return;

  ports.chat.conversations.forEach((conversation) => {
    const currentTask = conversation.task ?? null;
    if (!currentTask || resolveConversationTaskMode(currentTask) !== 'active') return;
    if (isConversationTaskTerminal(currentTask.status)) return;

    ports.chat.setConversationTask(conversation.id, {
      ...currentTask,
      mode: 'seed',
      updatedAt: currentTask.updatedAt
    });
  });
}
