import { describe, expect, it } from 'vitest';
import { buildWorkContext } from './workContext';

describe('buildWorkContext', () => {
  it('merges task, workspace, and runtime feedback into one deduped work projection', () => {
    const workContext = buildWorkContext({
      currentTask: {
        id: 'task-1',
        sourceMessageId: 'user-1',
        goal: '做一个小页面',
        title: '小页面',
        mode: 'active',
        status: 'running',
        stage: '补样式',
        steps: [],
        executions: [],
        createdAt: 1,
        updatedAt: 2
      },
      messages: [{
        id: 'assistant-1',
        role: 'assistant',
        content: '我先把页面壳起好，再接着补样式。',
        timestamp: 1
      }, {
        id: 'tool-write',
        role: 'system',
        origin: 'tool-runtime',
        content: '已写入 styles.css',
        timestamp: 2,
        toolInvocation: {
          id: 'tool-write',
          kind: 'createProjectFile',
          status: 'executed',
          title: '已写入工作区文件',
          summary: '已写入 styles.css',
          projectFileId: 'file-style'
        }
      }],
      activeProject: {
        id: 'mini-phone',
        title: 'Mini Phone',
        slug: 'mini-phone',
        tags: [],
        source: 'manual',
        fileCount: 3,
        files: [{
          fileId: 'file-style',
          title: 'Styles',
          language: 'css',
          path: 'styles.css',
          role: 'style',
          isEntry: false
        }]
      },
      runtimeFeedback: {
        events: [{
          id: 'rtf-1',
          kind: 'assistant_tool_preparation_failed',
          createdAt: 2,
          status: 'parse_failed',
          summary: '上一轮工具准备失败，工具块没有通过解析。',
          reasons: ['工具块里没有找到可执行动作。']
        }]
      }
    });

    expect(workContext.hasActiveTask).toBe(true);
    expect(workContext.taskLines).toContain('当前目标：做一个小页面');
    expect(workContext.taskLines).toContain('当前阶段：补样式');
    expect(workContext.workspaceLines).toEqual([
      '最近刚改过：styles.css',
      '工作台状态：最近修改未验证。'
    ]);
    expect(workContext.feedbackLines).toContain('当前工作区“Mini Phone”已有 3 个文件，但还没有可运行入口。');
    expect(workContext.feedbackLines).toContain('上一轮工具准备失败，工具块没有通过解析。 原因：工具块里没有找到可执行动作。');
    expect(workContext.lines.filter((line) => line === '最近刚改过：styles.css')).toHaveLength(1);
  });

  it('can describe workspace/runtime state without an active task', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      messages: [{
        id: 'tool-read',
        role: 'system',
        origin: 'tool-runtime',
        content: '已读取 index.html',
        timestamp: 1,
        toolInvocation: {
          id: 'tool-read',
          kind: 'readProjectFile',
          status: 'executed',
          title: '已读取工作区文件',
          summary: '已读取 index.html',
          projectFileId: 'file-entry'
        }
      }],
      activeProject: {
        id: 'workspace-1',
        title: 'Mini Phone',
        slug: 'mini-phone',
        entryFileId: 'file-entry',
        entryFilePath: 'index.html',
        tags: [],
        source: 'chat-generated',
        fileCount: 1,
        files: [{
          fileId: 'file-entry',
          title: 'Index',
          language: 'html',
          path: 'index.html',
          role: 'entry',
          isEntry: true
        }]
      }
    });

    expect(workContext.hasActiveTask).toBe(false);
    expect(workContext.taskLines).toEqual([]);
    expect(workContext.lines).toEqual([]);
  });

  it('keeps seed task goals as read-only work-site context', () => {
    const workContext = buildWorkContext({
      currentTask: {
        id: 'task-seed-1',
        sourceMessageId: 'user-1',
        goal: '帮我做个视觉小说多剧情分支',
        title: '帮我做个视觉小说多剧情分支',
        mode: 'seed',
        status: 'running',
        stage: '开始处理',
        steps: [],
        executions: [],
        createdAt: 1,
        updatedAt: 1
      },
      messages: []
    });

    expect(workContext.hasActiveTask).toBe(false);
    expect(workContext.taskLines).toEqual([
      '当前目标：帮我做个视觉小说多剧情分支',
      '当前阶段：开始处理'
    ]);
    expect(workContext.lines).toEqual([
      '当前目标：帮我做个视觉小说多剧情分支',
      '当前阶段：开始处理'
    ]);
  });

  it('summarizes the active workspace scene from recent tool result messages', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      activeProject: {
        id: 'workspace-1',
        title: 'Mini Phone',
        slug: 'mini-phone',
        entryFileId: 'file-entry',
        entryFilePath: 'index.html',
        tags: [],
        source: 'chat-generated',
        fileCount: 3,
        files: [
          {
            fileId: 'file-entry',
            title: 'Index',
            language: 'html',
            path: 'index.html',
            role: 'entry',
            isEntry: true
          },
          {
            fileId: 'file-style',
            title: 'Styles',
            language: 'css',
            path: 'styles.css',
            role: 'style',
            isEntry: false
          },
          {
            fileId: 'file-script',
            title: 'Script',
            language: 'javascript',
            path: 'script.js',
            role: 'logic',
            isEntry: false
          }
        ]
      },
      messages: [
        {
          id: 'tool-read',
          role: 'system',
          origin: 'tool-runtime',
          content: '已读取 index.html',
          timestamp: 1,
          toolInvocation: {
            id: 'tool-read',
            kind: 'readProjectFile',
            status: 'executed',
            title: '已读取工作区文件',
            summary: '已读取 index.html',
            projectFileId: 'file-entry'
          }
        },
        {
          id: 'tool-write-style',
          role: 'system',
          origin: 'tool-runtime',
          content: '已写入 styles.css',
          timestamp: 2,
          toolInvocation: {
            id: 'tool-write-style',
            kind: 'createProjectFile',
            status: 'executed',
            title: '已写入工作区文件',
            summary: '已写入 styles.css',
            projectFileId: 'file-style'
          }
        },
        {
          id: 'tool-write-script',
          role: 'system',
          origin: 'tool-runtime',
          content: '已写入 script.js',
          timestamp: 3,
          toolInvocation: {
            id: 'tool-write-script',
            kind: 'createProjectFile',
            status: 'executed',
            title: '已写入工作区文件',
            summary: '已写入 script.js',
            projectFileId: 'file-script'
          }
        }
      ]
    });

    expect(workContext.workspaceLines).toEqual([
      '最近刚改过：script.js、styles.css',
      '工作台状态：最近修改未验证。'
    ]);
  });

  it('derives recent file cues from settled tool result messages only', () => {
    const activeProject = {
      id: 'workspace-1',
      title: 'Mini Phone',
      slug: 'mini-phone',
      entryFileId: 'file-entry',
      entryFilePath: 'index.html',
      tags: [],
      source: 'chat-generated' as const,
      fileCount: 3,
      files: [
        {
          fileId: 'file-entry',
          title: 'Index',
          language: 'html',
          path: 'index.html',
          role: 'entry' as const,
          isEntry: true
        },
        {
          fileId: 'file-style',
          title: 'Styles',
          language: 'css',
          path: 'styles.css',
          role: 'style' as const,
          isEntry: false
        },
        {
          fileId: 'file-script',
          title: 'Script',
          language: 'javascript',
          path: 'script.js',
          role: 'logic' as const,
          isEntry: false
        }
      ]
    };
    const workContext = buildWorkContext({
      currentTask: null,
      activeProject,
      messages: [
        {
          id: 'tool-read',
          role: 'system',
          origin: 'tool-runtime',
          content: '已读取 index.html',
          timestamp: 1,
          toolInvocation: {
            id: 'tool-read',
            kind: 'readProjectFile',
            status: 'executed',
            title: '已读取工作区文件',
            summary: '已读取 index.html',
            projectFileId: 'file-entry'
          }
        },
        {
          id: 'tool-write',
          role: 'system',
          origin: 'tool-runtime',
          content: '已写入 styles.css 和 script.js',
          timestamp: 2,
          toolInvocation: {
            id: 'tool-write',
            kind: 'writeProjectFiles',
            status: 'executed',
            title: '已写入工作区文件',
            summary: '已写入 styles.css 和 script.js',
            projectFileIds: ['file-style', 'file-script']
          }
        }
      ]
    });

    expect(workContext.workspaceLines).toEqual([
      '最近刚改过：script.js、styles.css',
      '工作台状态：最近修改未验证。'
    ]);
  });

  it('keeps deleted workspace file paths in recent write cues', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      activeProject: {
        id: 'workspace-1',
        title: 'Mini Phone',
        slug: 'mini-phone',
        entryFileId: 'file-entry',
        entryFilePath: 'index.html',
        tags: [],
        source: 'chat-generated',
        fileCount: 1,
        files: [{
          fileId: 'file-entry',
          title: 'Index',
          language: 'html',
          path: 'index.html',
          role: 'entry',
          isEntry: true
        }]
      },
      messages: [{
        id: 'tool-delete',
        role: 'system',
        origin: 'tool-runtime',
        content: '已删除 styles/old.css',
        timestamp: 2,
        toolInvocation: {
          id: 'tool-delete',
          kind: 'deleteProjectFile',
          status: 'executed',
          title: '已删除工作区文件',
          summary: '已删除 styles/old.css',
          projectFileId: 'file-old-style',
          projectFilePaths: ['styles/old.css']
        }
      }]
    });

    expect(workContext.workspaceLines).toEqual([
      '最近刚改过：styles/old.css',
      '工作台状态：最近修改未验证。'
    ]);
  });

  it('marks recent workspace writes as needing a simulated workbench check', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      activeProject: {
        id: 'workspace-1',
        title: 'Mini Phone',
        slug: 'mini-phone',
        entryFileId: 'file-entry',
        entryFilePath: 'index.html',
        tags: [],
        source: 'chat-generated',
        fileCount: 2,
        files: [
          {
            fileId: 'file-entry',
            title: 'Index',
            language: 'html',
            path: 'index.html',
            role: 'entry',
            isEntry: true
          },
          {
            fileId: 'file-style',
            title: 'Styles',
            language: 'css',
            path: 'styles.css',
            role: 'style',
            isEntry: false
          }
        ]
      },
      messages: [{
        id: 'tool-write',
        role: 'system',
        origin: 'tool-runtime',
        content: '已替换 styles.css',
        timestamp: 2,
        toolInvocation: {
          id: 'tool-write',
          kind: 'replaceProjectFileLines',
          status: 'executed',
          title: '已替换工作区文件',
          summary: '已替换 styles.css',
          projectFileId: 'file-style'
        }
      }]
    });

    expect(workContext.workspaceLines).toEqual([
      '最近刚改过：styles.css',
      '工作台状态：最近修改未验证。'
    ]);
  });

  it('keeps the latest failed workspace diagnostic as compact continuation evidence', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      activeProject: {
        id: 'workspace-1',
        title: 'Mini Phone',
        slug: 'mini-phone',
        entryFileId: 'file-entry',
        entryFilePath: 'index.html',
        tags: [],
        source: 'chat-generated',
        fileCount: 2,
        files: [{
          fileId: 'file-entry',
          title: 'Index',
          language: 'html',
          path: 'index.html',
          role: 'entry',
          isEntry: true
        }]
      },
      messages: [{
        id: 'tool-runtime',
        role: 'system',
        origin: 'tool-runtime',
        content: '运行检查完成 · console error 1 条 · scripts/app.js:14',
        timestamp: 2,
        toolInvocation: {
          id: 'tool-runtime',
          kind: 'inspectProjectRuntime',
          status: 'executed',
          title: '运行工作区预览',
          summary: '运行检查完成 · console error 1 条 · scripts/app.js:14',
          projectDiagnostics: [{
            tool: 'inspectProjectRuntime',
            projectId: 'workspace-1',
            runnable: true,
            reason: 'console-error',
            entryFilePath: 'index.html',
            firstErrorFilePath: 'scripts/app.js',
            firstErrorLineNumber: 14,
            firstErrorMessage: 'ReferenceError: startApp is not defined',
            errorsCount: 1,
            warningsCount: 0
          }]
        }
      }]
    });

    expect(workContext.workspaceLines).toEqual([
      '最近运行检查未过：console-error · scripts/app.js:14 · ReferenceError: startApp is not defined。'
    ]);
  });

  it('marks diagnostics as stale when a later workspace write landed', () => {
    const activeProject = {
      id: 'workspace-1',
      title: 'Mini Phone',
      slug: 'mini-phone',
      entryFileId: 'file-entry',
      entryFilePath: 'index.html',
      tags: [],
      source: 'chat-generated' as const,
      fileCount: 2,
      files: [
        {
          fileId: 'file-entry',
          title: 'Index',
          language: 'html',
          path: 'index.html',
          role: 'entry' as const,
          isEntry: true
        },
        {
          fileId: 'file-style',
          title: 'Styles',
          language: 'css',
          path: 'styles.css',
          role: 'style' as const,
          isEntry: false
        }
      ]
    };
    const workContext = buildWorkContext({
      currentTask: null,
      activeProject,
      messages: [
        {
          id: 'tool-check',
          role: 'system',
          origin: 'tool-runtime',
          content: '预览检查通过 · index.html',
          timestamp: 2,
          toolInvocation: {
            id: 'tool-check',
            kind: 'checkProjectPreview',
            status: 'executed',
            title: '检查工作区预览',
            summary: '预览检查通过 · index.html',
            projectDiagnostics: [{
              tool: 'checkProjectPreview',
              projectId: 'workspace-1',
              runnable: true,
              reason: 'ok',
              entryFilePath: 'index.html',
              errorsCount: 0,
              warningsCount: 0
            }]
          }
        },
        {
          id: 'tool-write',
          role: 'system',
          origin: 'tool-runtime',
          content: '已替换 styles.css',
          timestamp: 3,
          toolInvocation: {
            id: 'tool-write',
            kind: 'replaceProjectFileLines',
            status: 'executed',
            title: '已替换工作区文件',
            summary: '已替换 styles.css',
            projectFileId: 'file-style'
          }
        }
      ]
    });

    expect(workContext.workspaceLines).toEqual([
      '最近刚改过：styles.css',
      '工作台状态：上次检查早于最近修改，诊断已过期。'
    ]);
  });

  it('projects assistant tool preparation failures as attention lines', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      messages: [],
      runtimeFeedback: {
        events: [{
          id: 'rtf-1',
          kind: 'assistant_tool_preparation_failed',
          createdAt: 2,
          status: 'parse_failed',
          summary: '上一轮工具准备失败，工具块没有通过解析。',
          reasons: ['工具块里没有找到可执行动作。']
        }]
      }
    });

    expect(workContext.feedbackLines).toEqual([
      '上一轮工具准备失败，工具块没有通过解析。 原因：工具块里没有找到可执行动作。'
    ]);
  });

  it('does not project raw malformed tool arguments into attention lines', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      messages: [],
      runtimeFeedback: {
        events: [{
          id: 'rtf-1',
          kind: 'assistant_tool_preparation_failed',
          createdAt: 2,
          status: 'parse_failed',
          summary: '上一轮工具准备失败，工具块没有通过解析。',
          reasons: [
            '原生工具 readProjectFile 解析失败，这次动作还没有真正执行。',
            '解析器提示：Unexpected non-whitespace character after JSON at position 115',
            '原始工具参数已从下一轮上下文省略。'
          ]
        }]
      }
    });

    expect(workContext.feedbackLines.join('\n')).not.toContain('memory-doc');
    expect(workContext.feedbackLines).toEqual([
      '上一轮工具准备失败，工具块没有通过解析。 原因：原生工具 readProjectFile 解析失败，这次动作还没有真正执行。；解析器提示：Unexpected non-whitespace character after JSON at position 115；原始工具参数已从下一轮上下文省略。'
    ]);
  });

  it('summarizes workspace scope changes as current state with visited workspaces', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      messages: [],
      activeProject: {
        id: 'workspace-new',
        title: 'Mini Phone',
        slug: 'mini-phone',
        tags: [],
        source: 'manual',
        fileCount: 1,
        files: []
      },
      visibleProjects: [
        {
          id: 'workspace-old',
          title: 'Old Lab',
          slug: 'old-lab',
          tags: [],
          source: 'manual',
          fileCount: 1,
          files: []
        },
        {
          id: 'workspace-new',
          title: 'Mini Phone',
          slug: 'mini-phone',
          tags: [],
          source: 'manual',
          fileCount: 1,
          files: []
        }
      ],
      runtimeFeedback: {
        events: [
          {
            id: 'rtf-1',
            kind: 'workspace_scope_changed',
            createdAt: 2,
            conversationId: 'conversation-1',
            change: 'entered',
            previousProjectId: null,
            nextProjectId: 'workspace-old',
            summary: '当前对话已进入工作区 workspace-old。'
          },
          {
            id: 'rtf-2',
            kind: 'workspace_scope_changed',
            createdAt: 3,
            conversationId: 'conversation-1',
            change: 'switched',
            previousProjectId: 'workspace-old',
            nextProjectId: 'workspace-new',
            summary: '当前对话已从工作区 workspace-old 切到 workspace-new。'
          }
        ]
      }
    });

    expect(workContext.feedbackLines).toContain('当前工作区：Mini Phone；本次对话还访问过：Old Lab。');
    expect(workContext.feedbackLines).not.toContain('当前对话已从工作区 Old Lab 切到 Mini Phone。');
  });

  it('falls back to workspace ids when the title is unavailable in work context', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      messages: [],
      runtimeFeedback: {
        events: [{
          id: 'rtf-1',
          kind: 'workspace_scope_changed',
          createdAt: 2,
          conversationId: 'conversation-1',
          change: 'entered',
          previousProjectId: null,
          nextProjectId: 'workspace-new',
          summary: '当前对话已进入工作区 workspace-new。'
        }]
      }
    });

    expect(workContext.feedbackLines).toContain('当前工作区：workspace-new。');
  });

  it('projects workspace open loops from the active project', () => {
    expect(buildWorkContext({
      currentTask: null,
      messages: [],
      activeProject: {
        id: 'workspace-empty',
        title: 'Mini Phone',
        slug: 'mini-phone',
        tags: [],
        source: 'manual',
        fileCount: 0,
        files: []
      }
    }).feedbackLines).toEqual(['当前工作区“Mini Phone”还没有文件。']);

    expect(buildWorkContext({
      currentTask: null,
      messages: [],
      activeProject: {
        id: 'workspace-no-entry',
        title: 'Mini Phone',
        slug: 'mini-phone',
        tags: [],
        source: 'manual',
        fileCount: 2,
        files: []
      }
    }).feedbackLines).toEqual(['当前工作区“Mini Phone”已有 2 个文件，但还没有可运行入口。']);

    expect(buildWorkContext({
      currentTask: null,
      messages: [],
      activeProject: {
        id: 'workspace-ready',
        title: 'Mini Phone',
        slug: 'mini-phone',
        entryFilePath: 'index.html',
        tags: [],
        source: 'manual',
        fileCount: 2,
        files: []
      }
    }).feedbackLines).toEqual([]);
  });

  it('projects pending workspace proposal attention lines', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      messages: [],
      runtimeFeedback: {
        pendingWorkspaceProposal: {
          id: 'proposal-1',
          conversationId: 'conversation-1',
          source: 'model-proposed',
          requestedProjectTitle: 'Mini Phone',
          requestedActionKinds: ['createRoomProject', 'createProjectFile'],
          requestedFilePaths: ['index.html', 'styles.css', 'app.js', 'readme.md', 'extra.txt'],
          draftProjectId: 'mini-phone',
          status: 'pending',
          createdAt: 1
        }
      }
    });

    expect(workContext.feedbackLines).toEqual([
      '当前对话还没进入工作区；现在有一个待确认的新工作区提议：Mini Phone。',
      '这些项目动作还没执行，仍在等待用户确认。',
      '提议涉及文件：index.html、styles.css、app.js、readme.md。'
    ]);
  });

  it('projects pending enter-workspace proposal attention lines', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      messages: [],
      runtimeFeedback: {
        pendingWorkspaceProposal: {
          id: 'proposal-1',
          conversationId: 'conversation-1',
          source: 'model-proposed',
          requestedActionKinds: ['writeProjectFiles'],
          draftProjectId: 'mini-phone',
          status: 'pending',
          createdAt: 1
        }
      }
    });

    expect(workContext.feedbackLines).toEqual([
      '当前对话还没进入工作区；现在有一个待确认的工作区进入提议：mini-phone。',
      '这些项目动作还没执行，仍在等待用户确认。'
    ]);
  });

  it('stays quiet for settled workspace proposals', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      messages: [],
      runtimeFeedback: {
        pendingWorkspaceProposal: {
          id: 'proposal-1',
          conversationId: 'conversation-1',
          source: 'model-proposed',
          requestedActionKinds: ['createRoomProject'],
          status: 'accepted',
          createdAt: 1
        }
      }
    });

    expect(workContext.feedbackLines).toEqual([]);
  });

  it('projects exited workspace state without inventing a current workspace', () => {
    const workContext = buildWorkContext({
      currentTask: null,
      messages: [],
      visibleProjects: [{
        id: 'mini-phone',
        title: 'Mini Phone',
        slug: 'mini-phone',
        tags: [],
        source: 'manual',
        fileCount: 1,
        files: []
      }],
      runtimeFeedback: {
        events: [{
          id: 'rtf-1',
          kind: 'workspace_scope_changed',
          createdAt: 1,
          conversationId: 'conversation-1',
          change: 'exited',
          previousProjectId: 'mini-phone',
          nextProjectId: null,
          summary: '当前对话已离开工作区 mini-phone。'
        }]
      }
    });

    expect(workContext.feedbackLines).toContain('当前对话不在工作区；本次对话曾访问：Mini Phone。');
  });
});
