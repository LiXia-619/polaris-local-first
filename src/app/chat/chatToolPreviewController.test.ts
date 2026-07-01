import { describe, expect, it, vi } from 'vitest';
import { createToolPreviewController } from './chatToolPreviewController';
import { buildCustomThemeFrame, buildThemeFrameFromPresetId } from '../../config/theme/themePresets';
import { createConversationTaskShell, reduceConversationTaskEvent } from '../../engines/conversationTask';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ChatMessage } from '../../types/domain';

function writableConversation(conversationId = 'conv-1', messages: ChatMessage[] = []): WritableConversationBody {
  return {
    conversationId,
    conversation: {
      id: conversationId,
      title: 'Test',
      collaboratorId: 'collab-1',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages
    },
    messages
  };
}

describe('createToolPreviewController', () => {
  it('replaces previous handwritten css when previewing a preset swap', async () => {
    const beforeTheme = {
      ...buildCustomThemeFrame(),
      customCSS: '.app-shell { backdrop-filter: blur(24px); }'
    };
    const beginThemePreview = vi.fn((_previewId: string, _conversationId: string, _nextTheme: unknown, _pending: string, _patchLedgerEntry?: unknown) => ({
      visibleThemeBeforeStart: beforeTheme
    }));

    const controller = createToolPreviewController({
      local: {
        setCommandStatus: vi.fn()
      },
      chat: {
        getConversationWritable: vi.fn(() => writableConversation()),
        getConversationTask: vi.fn(() => null),
        setConversationTask: vi.fn(),
        updateMessage: vi.fn()
      },
      space: {
        beginThemePreview,
        commitThemePreview: vi.fn(() => true),
        getActiveThemePreview: vi.fn(() => null),
        getCurrentThemeFrame: vi.fn(() => beforeTheme),
        rollbackThemePreview: vi.fn(() => true),
        saveCurrentSkin: vi.fn(() => null),
        themeToolMode: 'stable'
      },
      derived: {
        activeConversation: {
          id: 'conv-1',
          title: 'Test',
          collaboratorId: 'collab-1',
          messages: []
        }
      },
      memoryActions: {
        appendCollaboratorMemories: vi.fn(() => false),
        writeCollaboratorMemoryDoc: vi.fn(() => ({ ok: true as const, docId: 'memory-doc-1', title: '关系边界', created: true })),
        readCollaboratorMemoryDoc: vi.fn(async () => null),
        maybeHandleWriteMemoryAction: vi.fn(() => false),
        applyMemoryPreview: vi.fn(() => false),
        rollbackMemoryPreview: vi.fn(() => false)
      },
      addRuntimeToolMessage: vi.fn()
    });

    const result = await controller.runPreviewableToolAction(writableConversation(), {
      kind: 'applyPreset',
      presetId: 'paper-butter'
    });

    expect(result.ok).toBe(true);
    expect(beginThemePreview).toHaveBeenCalledTimes(1);
    expect(beginThemePreview.mock.calls[0]?.[2]).toEqual(buildThemeFrameFromPresetId('paper-butter'));
    expect(beginThemePreview.mock.calls[0]?.[4]).toEqual(expect.objectContaining({
      kind: 'applyPreset',
      label: expect.stringContaining('Paper / Bloom'),
      layer: 'preset'
    }));
  });

  it('marks the referenced task completed after confirming a theme preview', () => {
    const setConversationTask = vi.fn();
    const task = reduceConversationTaskEvent({
      currentTask: {
        ...createConversationTaskShell({
          sourceMessage: {
            id: 'user-1',
            content: '换个皮肤',
            timestamp: 1
          },
          createdAt: 10
        }),
        stage: '等你确认'
      },
      event: {
        type: 'tool_execution_recorded',
        execution: {
          assistantMessageId: 'assistant-1',
          resultMessageIds: ['tool-preview-message']
        },
        updatedAt: 20
      }
    });
    const previewMessage: ChatMessage = {
      id: 'tool-preview-message',
      role: 'system',
      content: '试穿中',
      timestamp: 1,
      toolInvocation: {
        id: 'tool-preview',
        kind: 'patchRawCss',
        status: 'preview',
        title: '直接改 CSS',
        summary: '试穿中',
        previewId: 'preview-1'
      }
    };

    const controller = createToolPreviewController({
      local: {
        setCommandStatus: vi.fn()
      },
      chat: {
        getConversationWritable: vi.fn(() => writableConversation('conv-1', [previewMessage])),
        getConversationTask: vi.fn(() => task),
        setConversationTask,
        updateMessage: vi.fn()
      },
      space: {
        beginThemePreview: vi.fn(),
        commitThemePreview: vi.fn(() => true),
        getActiveThemePreview: vi.fn(() => null),
        getCurrentThemeFrame: vi.fn(() => buildCustomThemeFrame()),
        rollbackThemePreview: vi.fn(() => true),
        saveCurrentSkin: vi.fn(() => null),
        themeToolMode: 'stable'
      },
      derived: {
        activeConversation: {
          id: 'conv-1',
          title: 'Test',
          collaboratorId: 'collab-1',
          messages: []
        }
      },
      memoryActions: {
        appendCollaboratorMemories: vi.fn(() => false),
        writeCollaboratorMemoryDoc: vi.fn(() => ({ ok: true as const, docId: 'memory-doc-1', title: '关系边界', created: true })),
        readCollaboratorMemoryDoc: vi.fn(async () => null),
        maybeHandleWriteMemoryAction: vi.fn(() => false),
        applyMemoryPreview: vi.fn(() => false),
        rollbackMemoryPreview: vi.fn(() => false)
      },
      addRuntimeToolMessage: vi.fn()
    });

    controller.applyToolPreview(previewMessage);

    expect(setConversationTask).toHaveBeenCalledWith('conv-1', expect.objectContaining({
      status: 'completed',
      stage: '已穿上这版换肤',
      summary: '这版试穿已经确认保留。'
    }));
  });

  it('does not commit a theme preview before a writable conversation is available', () => {
    const commitThemePreview = vi.fn(() => true);
    const previewMessage: ChatMessage = {
      id: 'tool-preview-message',
      role: 'system',
      content: '试穿中',
      timestamp: 1,
      toolInvocation: {
        id: 'tool-preview',
        kind: 'patchRawCss',
        status: 'preview',
        title: '直接改 CSS',
        summary: '试穿中',
        previewId: 'preview-1'
      }
    };
    const controller = createToolPreviewController({
      local: {
        setCommandStatus: vi.fn()
      },
      chat: {
        getConversationWritable: vi.fn(() => null),
        getConversationTask: vi.fn(() => null),
        setConversationTask: vi.fn(),
        updateMessage: vi.fn()
      },
      space: {
        beginThemePreview: vi.fn(),
        commitThemePreview,
        getActiveThemePreview: vi.fn(() => null),
        getCurrentThemeFrame: vi.fn(() => buildCustomThemeFrame()),
        rollbackThemePreview: vi.fn(() => true),
        saveCurrentSkin: vi.fn(() => null),
        themeToolMode: 'stable'
      },
      derived: {
        activeConversation: {
          id: 'conv-1',
          title: 'Test',
          collaboratorId: 'collab-1',
          messages: []
        }
      },
      memoryActions: {
        appendCollaboratorMemories: vi.fn(() => false),
        writeCollaboratorMemoryDoc: vi.fn(() => ({ ok: true as const, docId: 'memory-doc-1', title: '关系边界', created: true })),
        readCollaboratorMemoryDoc: vi.fn(async () => null),
        maybeHandleWriteMemoryAction: vi.fn(() => false),
        applyMemoryPreview: vi.fn(() => false),
        rollbackMemoryPreview: vi.fn(() => false)
      },
      addRuntimeToolMessage: vi.fn()
    });

    controller.applyToolPreview(previewMessage);

    expect(commitThemePreview).not.toHaveBeenCalled();
  });

  it('passes the writable conversation into memory preview actions', () => {
    const target = writableConversation();
    const applyMemoryPreview = vi.fn(() => true);
    const previewMessage: ChatMessage = {
      id: 'memory-preview-message',
      role: 'system',
      content: '确认写入记忆',
      timestamp: 1,
      toolInvocation: {
        id: 'tool-memory-preview',
        kind: 'writeMemory',
        status: 'preview',
        title: '确认写入记忆',
        summary: '确认写入',
        memoryItems: ['她的手机号是 123456']
      }
    };
    const controller = createToolPreviewController({
      local: {
        setCommandStatus: vi.fn()
      },
      chat: {
        getConversationWritable: vi.fn(() => target),
        getConversationTask: vi.fn(() => null),
        setConversationTask: vi.fn(),
        updateMessage: vi.fn()
      },
      space: {
        beginThemePreview: vi.fn(),
        commitThemePreview: vi.fn(() => true),
        getActiveThemePreview: vi.fn(() => null),
        getCurrentThemeFrame: vi.fn(() => buildCustomThemeFrame()),
        rollbackThemePreview: vi.fn(() => true),
        saveCurrentSkin: vi.fn(() => null),
        themeToolMode: 'stable'
      },
      derived: {
        activeConversation: {
          id: 'conv-1',
          title: 'Test',
          collaboratorId: 'collab-1',
          messages: []
        }
      },
      memoryActions: {
        appendCollaboratorMemories: vi.fn(() => false),
        writeCollaboratorMemoryDoc: vi.fn(() => ({ ok: true as const, docId: 'memory-doc-1', title: '关系边界', created: true })),
        readCollaboratorMemoryDoc: vi.fn(async () => null),
        maybeHandleWriteMemoryAction: vi.fn(() => false),
        applyMemoryPreview,
        rollbackMemoryPreview: vi.fn(() => false)
      },
      addRuntimeToolMessage: vi.fn()
    });

    controller.applyToolPreview(previewMessage);

    expect(applyMemoryPreview).toHaveBeenCalledWith(target, previewMessage);
  });

  it('commits and saves a theme preview as a saved skin', () => {
    const setCommandStatus = vi.fn();
    const saveCurrentSkin = vi.fn((name: string) => ({
      id: 'saved-skin-1',
      name,
      sourcePresetId: null,
      cssVariables: {},
      presetCSS: '',
      customCSS: '',
      generatedCSS: '.bubble.user { color: white; }',
      createdAt: 1,
      updatedAt: 1
    }));
    const previewMessage = {
      id: 'tool-preview-message',
      role: 'system' as const,
      content: '试穿中',
      timestamp: 1,
      toolInvocation: {
        id: 'tool-preview',
        kind: 'appendThemeCss' as const,
        status: 'preview' as const,
        title: '主题 CSS 追加',
        summary: '试穿中',
        previewId: 'preview-1',
        themeIntentLabel: '暮色气泡'
      }
    };

    const controller = createToolPreviewController({
      local: {
        setCommandStatus
      },
      chat: {
        getConversationWritable: vi.fn(() => writableConversation('conv-1', [previewMessage])),
        getConversationTask: vi.fn(() => null),
        setConversationTask: vi.fn(),
        updateMessage: vi.fn()
      },
      space: {
        beginThemePreview: vi.fn(),
        commitThemePreview: vi.fn(() => true),
        getActiveThemePreview: vi.fn(() => null),
        getCurrentThemeFrame: vi.fn(() => buildCustomThemeFrame()),
        rollbackThemePreview: vi.fn(() => true),
        saveCurrentSkin,
        themeToolMode: 'creative'
      },
      derived: {
        activeConversation: {
          id: 'conv-1',
          title: 'Test',
          collaboratorId: 'collab-1',
          messages: []
        }
      },
      memoryActions: {
        appendCollaboratorMemories: vi.fn(() => false),
        writeCollaboratorMemoryDoc: vi.fn(() => ({ ok: true as const, docId: 'memory-doc-1', title: '关系边界', created: true })),
        readCollaboratorMemoryDoc: vi.fn(async () => null),
        maybeHandleWriteMemoryAction: vi.fn(() => false),
        applyMemoryPreview: vi.fn(() => false),
        rollbackMemoryPreview: vi.fn(() => false)
      },
      addRuntimeToolMessage: vi.fn()
    });

    controller.saveToolPreview(previewMessage);

    expect(saveCurrentSkin).toHaveBeenCalledWith(expect.stringContaining('暮色气泡'));
    expect(setCommandStatus).toHaveBeenCalledWith('已保存到主题。', false);
  });

  it('stores the raw CSS on creative preview tool messages', async () => {
    const addRuntimeToolMessage = vi.fn();
    const controller = createToolPreviewController({
      local: {
        setCommandStatus: vi.fn()
      },
      chat: {
        getConversationWritable: vi.fn(() => writableConversation()),
        getConversationTask: vi.fn(() => null),
        setConversationTask: vi.fn(),
        updateMessage: vi.fn()
      },
      space: {
        beginThemePreview: vi.fn(() => ({
          visibleThemeBeforeStart: buildCustomThemeFrame()
        })),
        commitThemePreview: vi.fn(() => true),
        getActiveThemePreview: vi.fn(() => null),
        getCurrentThemeFrame: vi.fn(() => buildCustomThemeFrame()),
        rollbackThemePreview: vi.fn(() => true),
        saveCurrentSkin: vi.fn(() => null),
        themeToolMode: 'creative'
      },
      derived: {
        activeConversation: {
          id: 'conv-1',
          title: 'Test',
          collaboratorId: 'collab-1',
          messages: []
        }
      },
      memoryActions: {
        appendCollaboratorMemories: vi.fn(() => false),
        writeCollaboratorMemoryDoc: vi.fn(() => ({ ok: true as const, docId: 'memory-doc-1', title: '关系边界', created: true })),
        readCollaboratorMemoryDoc: vi.fn(async () => null),
        maybeHandleWriteMemoryAction: vi.fn(() => false),
        applyMemoryPreview: vi.fn(() => false),
        rollbackMemoryPreview: vi.fn(() => false)
      },
      addRuntimeToolMessage
    });

    await controller.runPreviewableToolAction(writableConversation(), {
      kind: 'patchRawCss',
      css: '.app-shell.collection { background: #111827; }'
    });

    expect(addRuntimeToolMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1' }),
      expect.objectContaining({
        kind: 'patchRawCss',
        detailText: '.app-shell.collection { background: #111827; }',
        themeScope: 'collection',
        themeSurfaceLabels: ['收藏背景']
      }),
      undefined,
      expect.anything()
    );
  });

  it('attaches readable patch ledger metadata to theme previews', async () => {
    const beginThemePreview = vi.fn((_previewId: string, _conversationId: string, _nextTheme: unknown, _pending: string, _patchLedgerEntry?: unknown) => ({
      visibleThemeBeforeStart: buildCustomThemeFrame()
    }));
    const controller = createToolPreviewController({
      local: {
        setCommandStatus: vi.fn()
      },
      chat: {
        getConversationWritable: vi.fn(() => writableConversation()),
        getConversationTask: vi.fn(() => null),
        setConversationTask: vi.fn(),
        updateMessage: vi.fn()
      },
      space: {
        beginThemePreview,
        commitThemePreview: vi.fn(() => true),
        getActiveThemePreview: vi.fn(() => null),
        getCurrentThemeFrame: vi.fn(() => buildCustomThemeFrame()),
        rollbackThemePreview: vi.fn(() => true),
        saveCurrentSkin: vi.fn(() => null),
        themeToolMode: 'creative'
      },
      derived: {
        activeConversation: {
          id: 'conv-1',
          title: 'Test',
          collaboratorId: 'collab-1',
          messages: []
        }
      },
      memoryActions: {
        appendCollaboratorMemories: vi.fn(() => false),
        writeCollaboratorMemoryDoc: vi.fn(() => ({ ok: true as const, docId: 'memory-doc-1', title: '关系边界', created: true })),
        readCollaboratorMemoryDoc: vi.fn(async () => null),
        maybeHandleWriteMemoryAction: vi.fn(() => false),
        applyMemoryPreview: vi.fn(() => false),
        rollbackMemoryPreview: vi.fn(() => false)
      },
      addRuntimeToolMessage: vi.fn()
    });

    await controller.runPreviewableToolAction(writableConversation(), {
      kind: 'appendThemeCss',
      css: '.bubble.user { border-radius: 999px; }',
      layer: 'generated',
      label: '吐司气泡'
    });

    expect(beginThemePreview.mock.calls[0]?.[4]).toEqual(expect.objectContaining({
      conversationId: 'conv-1',
      kind: 'appendThemeCss',
      label: expect.stringContaining('吐司气泡'),
      layer: 'generated',
      detailText: '.bubble.user { border-radius: 999px; }',
      patchMode: 'merge'
    }));
  });
});
