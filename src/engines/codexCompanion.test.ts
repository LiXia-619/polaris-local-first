import { describe, expect, it } from 'vitest';
import {
  countCodexUserMessages,
  createCodexCompanionSnapshot,
  isCodexThreadReadDeferredError,
  isCodexThreadBusy,
  isCodexThreadStatusBusy,
  isCodexThreadLoaded,
  pickCodexCompanionThread,
  reconcileCodexPendingCommands,
  type CodexThread
} from './codexCompanion';

describe('pickCodexCompanionThread', () => {
  it('prefers the requested thread id when present', () => {
    const left: CodexThread = {
      id: 'thread-a',
      name: 'Older',
      preview: 'older',
      updatedAt: 100,
      status: 'completed',
      cwd: '/tmp/a',
      turns: []
    };
    const right: CodexThread = {
      id: 'thread-b',
      name: 'Newer',
      preview: 'newer',
      updatedAt: 200,
      status: 'completed',
      cwd: '/tmp/b',
      turns: []
    };

    expect(pickCodexCompanionThread([left, right], 'thread-a')?.id).toBe('thread-a');
    expect(pickCodexCompanionThread([left, right], null)?.id).toBe('thread-b');
  });
});

describe('createCodexCompanionSnapshot', () => {
  it('maps Codex thread items into readable Polaris messages', () => {
    const snapshot = createCodexCompanionSnapshot({
      hostId: 'host-1',
      hostLabel: 'Desk Codex',
      thread: {
        id: 'thread-1',
        name: 'Ship the bridge',
        preview: 'ship',
        updatedAt: 1_710_000_000,
        status: 'inProgress',
        cwd: '/tmp/project',
        turns: [
          {
            id: 'turn-1',
            status: 'completed',
            items: [
              {
                type: 'userMessage',
                id: 'user-1',
                content: [{ type: 'text', text: 'continue the adapter', text_elements: [] }]
              },
              {
                type: 'commandExecution',
                id: 'cmd-1',
                command: 'npm test',
                status: 'completed',
                aggregatedOutput: 'ok',
                exitCode: 0
              },
              {
                type: 'agentMessage',
                id: 'assistant-1',
                text: 'Bridge is ready.',
                phase: 'final_answer'
              }
            ]
          }
        ]
      }
    });

    expect(snapshot.conversationTitle).toBe('Ship the bridge');
    expect(snapshot.collaboratorName).toBe('Codex');
    expect(snapshot.messages.map((message) => [message.role, message.content])).toEqual([
      ['user', 'continue the adapter'],
      ['system', '命令 已完成：npm test'],
      ['assistant', 'Bridge is ready.']
    ]);
  });

  it('strips desktop-only app directives from mirrored assistant messages', () => {
    const snapshot = createCodexCompanionSnapshot({
      hostId: 'host-1',
      hostLabel: 'Desk Codex',
      thread: {
        id: 'thread-1',
        name: 'Ship the bridge',
        preview: 'ship',
        updatedAt: 1_710_000_000,
        status: { type: 'idle' },
        cwd: '/tmp/project',
        turns: [
          {
            id: 'turn-1',
            status: 'completed',
            items: [
              {
                type: 'agentMessage',
                id: 'assistant-1',
                text: `已经提交了。

::git-stage{cwd="/tmp/project"}
::git-commit{cwd="/tmp/project"}`,
                phase: 'final_answer'
              }
            ]
          }
        ]
      }
    });

    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]?.content).toBe('已经提交了。');
  });

  it('ignores tiny commentary fragments made only of symbols', () => {
    const snapshot = createCodexCompanionSnapshot({
      hostId: 'host-1',
      hostLabel: 'Desk Codex',
      thread: {
        id: 'thread-1',
        name: 'Ship the bridge',
        preview: 'ship',
        updatedAt: 1_710_000_000,
        status: { type: 'idle' },
        cwd: '/tmp/project',
        turns: [
          {
            id: 'turn-1',
            status: 'completed',
            items: [
              {
                type: 'agentMessage',
                id: 'assistant-ghost',
                text: '…',
                phase: 'commentary'
              },
              {
                type: 'agentMessage',
                id: 'assistant-1',
                text: '真的连上了。',
                phase: 'final_answer'
              }
            ]
          }
        ]
      }
    });

    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]?.content).toBe('真的连上了。');
  });

  it('appends pending phone commands until Codex thread materializes them', () => {
    const thread: CodexThread = {
      id: 'thread-1',
      name: 'Ship the bridge',
      preview: 'ship',
      updatedAt: 1_710_000_000,
      status: { type: 'idle' },
      cwd: '/tmp/project',
      turns: [
        {
          id: 'turn-1',
          status: 'completed',
          items: [
            {
              type: 'agentMessage',
              id: 'assistant-1',
              text: '等你下一句。',
              phase: 'final_answer'
            }
          ]
        }
      ]
    };

    const snapshot = createCodexCompanionSnapshot({
      hostId: 'host-1',
      hostLabel: 'Desk Codex',
      thread,
      pendingCommands: [
        {
          id: 'pending-1',
          text: 'HELLO_FROM_PHONE',
          createdAt: 123,
          userMessageCountBase: 0
        }
      ]
    });

    expect(snapshot.messages.map((message) => [message.id, message.role, message.content])).toEqual([
      ['assistant-1', 'assistant', '等你下一句。'],
      ['pending-1', 'user', 'HELLO_FROM_PHONE']
    ]);
  });

  it('keeps the full mirrored thread instead of trimming to the latest 120 messages', () => {
    const turns: CodexThread['turns'] = Array.from({ length: 130 }, (_, index) => ({
      id: `turn-${index + 1}`,
      status: 'completed',
      items: [{
        type: 'agentMessage' as const,
        id: `assistant-${index + 1}`,
        text: `message ${index + 1}`,
        phase: 'final_answer' as const
      }]
    }));

    const snapshot = createCodexCompanionSnapshot({
      hostId: 'host-1',
      hostLabel: 'Desk Codex',
      thread: {
        id: 'thread-1',
        name: 'Long mirror',
        preview: 'long',
        updatedAt: 1_710_000_000,
        status: { type: 'idle' },
        cwd: '/tmp/project',
        turns
      }
    });

    expect(snapshot.messages).toHaveLength(130);
    expect(snapshot.messages[0]?.content).toBe('message 1');
    expect(snapshot.messages[129]?.content).toBe('message 130');
  });
});

describe('isCodexThreadBusy', () => {
  it('tracks busy state from turn status instead of thread status text', () => {
    const idleThread: CodexThread = {
      id: 'thread-idle',
      name: 'Idle',
      preview: 'idle',
      updatedAt: 1,
      status: { type: 'idle' },
      cwd: '/tmp/project',
      turns: [
        {
          id: 'turn-1',
          status: 'completed',
          items: []
        }
      ]
    };
    const busyThread: CodexThread = {
      ...idleThread,
      id: 'thread-busy',
      turns: [
        {
          id: 'turn-2',
          status: 'inProgress',
          items: []
        }
      ]
    };

    expect(isCodexThreadBusy(idleThread)).toBe(false);
    expect(isCodexThreadBusy(busyThread)).toBe(true);
  });

  it('does not treat plain active status as busy by itself', () => {
    const thread: CodexThread = {
      id: 'thread-active',
      name: 'Active',
      preview: 'active',
      updatedAt: 1,
      status: { type: 'active' },
      cwd: '/tmp/project',
      turns: []
    };

    expect(isCodexThreadBusy(thread)).toBe(false);
  });

  it('treats active threads with blocking flags as busy', () => {
    const thread: CodexThread = {
      id: 'thread-waiting',
      name: 'Waiting',
      preview: 'waiting',
      updatedAt: 1,
      status: {
        type: 'active',
        activeFlags: ['waitingOnApproval']
      },
      cwd: '/tmp/project',
      turns: []
    };

    expect(isCodexThreadBusy(thread)).toBe(true);
    expect(isCodexThreadStatusBusy(thread.status)).toBe(true);
  });
});

describe('isCodexThreadLoaded', () => {
  it('treats notLoaded threads as unavailable for direct turn/start', () => {
    const thread: CodexThread = {
      id: 'thread-cold',
      name: 'Cold',
      preview: 'cold',
      updatedAt: 1,
      status: { type: 'notLoaded' },
      cwd: '/tmp/project',
      turns: []
    };

    expect(isCodexThreadLoaded(thread)).toBe(false);
    expect(isCodexThreadLoaded({ ...thread, status: { type: 'idle' } })).toBe(true);
  });
});

describe('countCodexUserMessages', () => {
  it('counts only materialized user messages', () => {
    const thread: CodexThread = {
      id: 'thread-1',
      name: 'Count',
      preview: 'count',
      updatedAt: 1,
      status: { type: 'idle' },
      cwd: '/tmp/project',
      turns: [
        {
          id: 'turn-1',
          status: 'completed',
          items: [
            {
              type: 'userMessage',
              id: 'user-1',
              content: [{ type: 'text', text: 'first', text_elements: [] }]
            },
            {
              type: 'agentMessage',
              id: 'assistant-1',
              text: 'ok',
              phase: 'final_answer'
            },
            {
              type: 'userMessage',
              id: 'user-2',
              content: [{ type: 'text', text: 'second', text_elements: [] }]
            }
          ]
        }
      ]
    };

    expect(countCodexUserMessages(thread)).toBe(2);
  });
});

describe('reconcileCodexPendingCommands', () => {
  it('drops pending commands once matching user turns appear in order', () => {
    const thread: CodexThread = {
      id: 'thread-1',
      name: 'Pending',
      preview: 'pending',
      updatedAt: 1,
      status: { type: 'idle' },
      cwd: '/tmp/project',
      turns: [
        {
          id: 'turn-1',
          status: 'completed',
          items: [
            {
              type: 'userMessage',
              id: 'user-1',
              content: [{ type: 'text', text: 'old', text_elements: [] }]
            },
            {
              type: 'userMessage',
              id: 'user-2',
              content: [{ type: 'text', text: 'first pending', text_elements: [] }]
            }
          ]
        }
      ]
    };

    expect(
      reconcileCodexPendingCommands(thread, [
        {
          id: 'pending-1',
          text: 'first pending',
          createdAt: 1,
          userMessageCountBase: 1
        },
        {
          id: 'pending-2',
          text: 'second pending',
          createdAt: 2,
          userMessageCountBase: 2
        }
      ]).map((command) => command.id)
    ).toEqual(['pending-2']);
  });
});

describe('isCodexThreadReadDeferredError', () => {
  it('recognizes the temporary materialization error from app-server', () => {
    expect(
      isCodexThreadReadDeferredError(
        new Error('thread abc is not materialized yet; includeTurns is unavailable before first user message')
      )
    ).toBe(true);
    expect(isCodexThreadReadDeferredError(new Error('some other failure'))).toBe(false);
  });
});
