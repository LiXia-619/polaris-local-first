import { describe, expect, it, vi } from 'vitest';
import { createConversationTaskShell, reduceConversationTaskEvent } from '../../../engines/conversationTask';
import type { ToolActionRunOutcome } from '../../../app/chat/chatToolOutcome';
import type { ConversationTaskState } from '../../../types/domain';
import type { PendingWorkspaceProposalRecord } from '../../../engines/workspaceBinding';
import { acceptPendingWorkspaceProposal, rejectPendingWorkspaceProposal } from './workspaceProposalActions';

describe('acceptPendingWorkspaceProposal', () => {
  it('syncs chat workspace from the executed conversation after promote-to-project proposals', async () => {
    const conversations = [{ id: 'conversation-1', activeProjectId: null as string | null }];
    const proposal: PendingWorkspaceProposalRecord = {
      id: 'proposal-1',
      conversationId: 'conversation-1',
      source: 'model-proposed',
      requestedProjectTitle: 'Mini Phone',
      requestedActionKinds: ['promoteCardToProject'],
      requestedFilePaths: ['index.html'],
      draftProjectId: undefined,
      status: 'pending',
      createdAt: 1,
      requestedActions: [{
        kind: 'promoteCardToProject',
        cardId: 'card-1',
        projectTitle: 'Mini Phone',
        filePath: 'index.html',
        fileRole: 'entry',
        openInCollection: false
      }]
    };
    const submitAssistantToolActions = vi.fn(async () => {
      conversations[0].activeProjectId = 'workspace-mini-phone';
      return [];
    });
    const appendRuntimeFeedbackEvent = vi.fn();
    const setCommandStatus = vi.fn();

    await acceptPendingWorkspaceProposal({
      activeConversation: conversations[0],
      proposal,
      workspaces: [{ id: 'workspace-mini-phone', title: 'Mini Phone' }],
      setConversationActiveProject: vi.fn(),
      removePendingWorkspaceProposal: vi.fn(),
      submitAssistantToolActions,
      findConversation: (conversationId) => conversations.find((conversation) => conversation.id === conversationId) ?? null,
      appendRuntimeFeedbackEvent,
      setCommandStatus
    });

    expect(submitAssistantToolActions).toHaveBeenCalledWith('conversation-1', proposal.requestedActions, {
      workspaceExecutionMode: 'execute-approved'
    });
    expect(appendRuntimeFeedbackEvent).toHaveBeenCalledWith(
      'conversation-1',
      expect.objectContaining({
        kind: 'workspace_proposal_resolved',
        decision: 'accepted',
        summary: '已同意新建工作区 Mini Phone，相关工作区动作将继续执行。'
      })
    );
    expect(setCommandStatus).toHaveBeenNthCalledWith(1, '正在创建 Mini Phone…');
    expect(setCommandStatus).toHaveBeenNthCalledWith(2, '继续在 Mini Phone 里处理…');
  });

  it('prebinds the draft workspace before continuing in-scope workspace actions', async () => {
    const conversations = [{ id: 'conversation-1', activeProjectId: null as string | null }];
    const proposal: PendingWorkspaceProposalRecord = {
      id: 'proposal-1',
      conversationId: 'conversation-1',
      source: 'model-proposed',
      requestedProjectTitle: 'Mini Phone',
      requestedActionKinds: ['readProjectFile'],
      requestedFilePaths: ['index.html'],
      draftProjectId: 'workspace-mini-phone',
      status: 'pending',
      createdAt: 1,
      requestedActions: [{
        kind: 'readProjectFile',
        fileId: 'file-1',
        targetLabel: 'index.html'
      }]
    };
    const setConversationActiveProject = vi.fn((conversationId: string, projectId: string | null) => {
      const conversation = conversations.find((entry) => entry.id === conversationId);
      if (conversation) {
        conversation.activeProjectId = projectId;
      }
    });
    const submitAssistantToolActions = vi.fn(async () => {
      expect(conversations[0].activeProjectId).toBe('workspace-mini-phone');
      return [];
    });
    const appendRuntimeFeedbackEvent = vi.fn();

    await acceptPendingWorkspaceProposal({
      activeConversation: conversations[0],
      proposal,
      workspaces: [{ id: 'workspace-mini-phone', title: 'Mini Phone' }],
      setConversationActiveProject,
      removePendingWorkspaceProposal: vi.fn(),
      submitAssistantToolActions,
      findConversation: (conversationId) => conversations.find((conversation) => conversation.id === conversationId) ?? null,
      appendRuntimeFeedbackEvent,
      setCommandStatus: vi.fn()
    });

    expect(setConversationActiveProject).toHaveBeenCalledWith('conversation-1', 'workspace-mini-phone');
    expect(appendRuntimeFeedbackEvent).toHaveBeenCalledWith(
      'conversation-1',
      expect.objectContaining({
        kind: 'workspace_proposal_resolved',
        decision: 'accepted'
      })
    );
  });

  it('waits until createRoomProject finishes before binding a brand-new workspace scope', async () => {
    const conversations = [{ id: 'conversation-1', activeProjectId: null as string | null }];
    const proposal: PendingWorkspaceProposalRecord = {
      id: 'proposal-1',
      conversationId: 'conversation-1',
      source: 'model-proposed',
      requestedProjectTitle: 'Mini Phone',
      requestedActionKinds: ['createRoomProject', 'createProjectFile'],
      requestedFilePaths: ['index.html'],
      draftProjectId: 'workspace-mini-phone',
      status: 'pending',
      createdAt: 1,
      requestedActions: [
        {
          kind: 'createRoomProject',
          project: {
            projectId: 'workspace-mini-phone',
            title: 'Mini Phone'
          },
          openInCollection: false
        },
        {
          kind: 'createProjectFile',
          file: {
            projectId: 'workspace-mini-phone',
            filePath: 'index.html',
            fileRole: 'entry',
            language: 'html',
            code: '<main>Hello</main>'
          },
          openInCollection: false
        }
      ]
    };
    const setConversationActiveProject = vi.fn((conversationId: string, projectId: string | null) => {
      const conversation = conversations.find((entry) => entry.id === conversationId);
      if (conversation) {
        conversation.activeProjectId = projectId;
      }
    });
    const submitAssistantToolActions = vi.fn(async (): Promise<ToolActionRunOutcome[]> => {
      expect(conversations[0].activeProjectId).toBeNull();
      return [
        {
          path: 'direct' as const,
          status: 'executed' as const,
          action: proposal.requestedActions[0],
          toolInvocation: {
            id: 'tool-create-project',
            kind: 'createRoomProject',
            status: 'executed',
            title: '创建工作区',
            summary: '已创建工作区 · Mini Phone'
          }
        },
        {
          path: 'direct' as const,
          status: 'executed' as const,
          action: proposal.requestedActions[1],
          toolInvocation: {
            id: 'tool-create-file',
            kind: 'createProjectFile',
            status: 'executed',
            title: '创建工作区文件',
            summary: '已创建工作区文件 · index.html'
          }
        }
      ];
    });
    const appendRuntimeFeedbackEvent = vi.fn();
    const setCommandStatus = vi.fn();

    await acceptPendingWorkspaceProposal({
      activeConversation: conversations[0],
      proposal,
      workspaces: [{ id: 'workspace-mini-phone', title: 'Mini Phone' }],
      setConversationActiveProject,
      removePendingWorkspaceProposal: vi.fn(),
      submitAssistantToolActions,
      findConversation: (conversationId) => conversations.find((conversation) => conversation.id === conversationId) ?? null,
      appendRuntimeFeedbackEvent,
      setCommandStatus
    });

    expect(setConversationActiveProject).toHaveBeenCalledTimes(1);
    expect(setConversationActiveProject).toHaveBeenCalledWith('conversation-1', 'workspace-mini-phone');
    expect(appendRuntimeFeedbackEvent).toHaveBeenCalledWith(
      'conversation-1',
      expect.objectContaining({
        kind: 'workspace_proposal_resolved',
        decision: 'accepted'
      })
    );
  });

  it('resolves the task boundary and requests a follow-up after the workspace is accepted', async () => {
    const conversations = [{
      id: 'conversation-1',
      activeProjectId: null as string | null,
      collaboratorId: 'nova'
    }];
    let task: ConversationTaskState | null = reduceConversationTaskEvent({
      currentTask: {
        ...createConversationTaskShell({
          sourceMessage: {
            id: 'user-1',
            content: '做一个调参小工具',
            timestamp: 1
          },
          createdAt: 1,
          mode: 'active'
        }),
        mode: 'active',
        stage: '等你确认工作区边界',
        next: '你确认后我会接着继续施工。'
      },
      event: {
        type: 'tool_execution_recorded',
        execution: {
          assistantMessageId: 'assistant-1',
          pendingProposalIds: ['proposal-1']
        },
        updatedAt: 2
      }
    });
    const proposal: PendingWorkspaceProposalRecord = {
      id: 'proposal-1',
      conversationId: 'conversation-1',
      source: 'model-proposed',
      requestedProjectTitle: '用户 的调参小工具',
      requestedActionKinds: ['createRoomProject'],
      requestedFilePaths: [],
      draftProjectId: 'workspace-tuner',
      status: 'pending',
      createdAt: 1,
      requestedActions: [{
        kind: 'createRoomProject',
        project: {
          projectId: 'workspace-tuner',
          title: '用户 的调参小工具'
        },
        openInCollection: false
      }]
    };
    const setConversationActiveProject = vi.fn((conversationId: string, projectId: string | null) => {
      const conversation = conversations.find((entry) => entry.id === conversationId);
      if (conversation) {
        conversation.activeProjectId = projectId;
      }
    });
    const submitAssistantToolActions = vi.fn(async (): Promise<ToolActionRunOutcome[]> => [{
      path: 'direct',
      status: 'executed',
      action: proposal.requestedActions[0],
      toolInvocation: {
        id: 'tool-create-project',
        kind: 'createRoomProject',
        status: 'executed',
        title: '创建工作区',
        summary: '已创建工作区 · 用户 的调参小工具'
      }
    }]);
    const continueAfterAccept = vi.fn(async () => {});

    await acceptPendingWorkspaceProposal({
      activeConversation: conversations[0],
      proposal,
      workspaces: [{ id: 'workspace-tuner', title: '用户 的调参小工具' }],
      setConversationActiveProject,
      removePendingWorkspaceProposal: vi.fn(),
      submitAssistantToolActions,
      findConversation: (conversationId) => conversations.find((conversation) => conversation.id === conversationId) ?? null,
      appendRuntimeFeedbackEvent: vi.fn(),
      getConversationTask: vi.fn(() => task),
      setConversationTask: vi.fn((_conversationId, nextTask) => {
        task = nextTask;
      }),
      continueAfterAccept,
      setCommandStatus: vi.fn()
    });

    expect(task?.executions[0]?.pendingProposalIds).toEqual([]);
    expect(task).toMatchObject({
      stage: '工作区已确认',
      next: '我会接着继续施工。'
    });
    expect(continueAfterAccept).toHaveBeenCalledWith('conversation-1');
  });
});

describe('rejectPendingWorkspaceProposal', () => {
  it('reports staying inside the current workspace when rejecting a switch', () => {
    const appendRuntimeFeedbackEvent = vi.fn();
    const setCommandStatus = vi.fn();

    rejectPendingWorkspaceProposal({
      activeConversation: { id: 'conversation-1', activeProjectId: 'workspace-mini-phone' },
      proposal: {
        id: 'proposal-1',
        conversationId: 'conversation-1',
        source: 'model-proposed',
        requestedProjectTitle: 'Docs Refresh',
        requestedActionKinds: ['createRoomProject'],
        requestedFilePaths: [],
        draftProjectId: 'workspace-docs-refresh',
        status: 'pending',
        createdAt: 1,
        requestedActions: []
      },
      workspaces: [{ id: 'workspace-mini-phone', title: 'Mini Phone' }],
      removePendingWorkspaceProposal: vi.fn(),
      appendRuntimeFeedbackEvent,
      setCommandStatus
    });

    expect(appendRuntimeFeedbackEvent).toHaveBeenCalledWith(
      'conversation-1',
      expect.objectContaining({
        kind: 'workspace_proposal_resolved',
        decision: 'rejected',
        summary: '已留在当前工作区 Mini Phone，没有切到 Docs Refresh。'
      })
    );
    expect(setCommandStatus).toHaveBeenCalledWith('继续留在 Mini Phone。');
  });

  it('keeps scatter mode when rejecting a fresh workspace proposal', () => {
    const setCommandStatus = vi.fn();

    rejectPendingWorkspaceProposal({
      activeConversation: { id: 'conversation-1', activeProjectId: null },
      proposal: {
        id: 'proposal-1',
        conversationId: 'conversation-1',
        source: 'model-proposed',
        requestedProjectTitle: 'Docs Refresh',
        requestedActionKinds: ['createRoomProject'],
        requestedFilePaths: [],
        draftProjectId: 'workspace-docs-refresh',
        status: 'pending',
        createdAt: 1,
        requestedActions: []
      },
      workspaces: [],
      removePendingWorkspaceProposal: vi.fn(),
      appendRuntimeFeedbackEvent: vi.fn(),
      setCommandStatus
    });

    expect(setCommandStatus).toHaveBeenCalledWith('先留在当前对话。');
  });
});
