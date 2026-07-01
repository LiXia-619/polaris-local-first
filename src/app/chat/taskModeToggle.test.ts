import { describe, expect, it, vi } from 'vitest';
import type { ConversationTaskState } from '../../types/domain';
import { setTaskModeEnabledForConversations } from './taskModeToggle';

function createTask(patch: Partial<ConversationTaskState> = {}): ConversationTaskState {
  return {
    id: 'task-1',
    sourceMessageId: 'm-1',
    goal: 'finish the thing',
    title: 'Finish the thing',
    mode: 'active',
    status: 'running',
    stage: 'Working',
    steps: [],
    executions: [],
    createdAt: 100,
    updatedAt: 120,
    ...patch
  };
}

describe('setTaskModeEnabledForConversations', () => {
  it('demotes every active non-terminal task when task mode is disabled', () => {
    const firstTask = createTask({ id: 'task-1' });
    const secondTask = createTask({ id: 'task-2' });
    const setTaskModeEnabled = vi.fn();
    const setConversationTask = vi.fn();

    setTaskModeEnabledForConversations({
      runtime: { setTaskModeEnabled },
      chat: {
        conversations: [
          { id: 'c-1', task: firstTask },
          { id: 'c-2', task: secondTask }
        ],
        setConversationTask
      }
    }, false);

    expect(setTaskModeEnabled).toHaveBeenCalledWith(false);
    expect(setConversationTask).toHaveBeenCalledWith('c-1', {
      ...firstTask,
      mode: 'seed',
      updatedAt: firstTask.updatedAt
    });
    expect(setConversationTask).toHaveBeenCalledWith('c-2', {
      ...secondTask,
      mode: 'seed',
      updatedAt: secondTask.updatedAt
    });
  });

  it('leaves a seed task alone when task mode is disabled', () => {
    const task = createTask({ mode: 'seed' });
    const setConversationTask = vi.fn();

    setTaskModeEnabledForConversations({
      runtime: { setTaskModeEnabled: vi.fn() },
      chat: {
        conversations: [{ id: 'c-1', task }],
        setConversationTask
      }
    }, false);

    expect(setConversationTask).not.toHaveBeenCalled();
  });

  it('leaves terminal active tasks alone when task mode is disabled', () => {
    const task = createTask({ status: 'completed' });
    const setConversationTask = vi.fn();

    setTaskModeEnabledForConversations({
      runtime: { setTaskModeEnabled: vi.fn() },
      chat: {
        conversations: [{ id: 'c-1', task }],
        setConversationTask
      }
    }, false);

    expect(setConversationTask).not.toHaveBeenCalled();
  });

  it('does not change conversation tasks when enabling task mode', () => {
    const setTaskModeEnabled = vi.fn();
    const setConversationTask = vi.fn();

    setTaskModeEnabledForConversations({
      runtime: { setTaskModeEnabled },
      chat: {
        conversations: [{ id: 'c-1', task: createTask() }],
        setConversationTask
      }
    }, true);

    expect(setTaskModeEnabled).toHaveBeenCalledWith(true);
    expect(setConversationTask).not.toHaveBeenCalled();
  });

  it('only flips the runtime switch when there are no conversation tasks', () => {
    const setTaskModeEnabled = vi.fn();
    const setConversationTask = vi.fn();

    setTaskModeEnabledForConversations({
      runtime: { setTaskModeEnabled },
      chat: {
        conversations: [],
        setConversationTask
      }
    }, false);

    expect(setTaskModeEnabled).toHaveBeenCalledWith(false);
    expect(setConversationTask).not.toHaveBeenCalled();
  });
});
