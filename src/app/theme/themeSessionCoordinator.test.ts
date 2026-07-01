import { describe, expect, it, vi } from 'vitest';
import { createThemePreviewCoordinator, createThemeSessionCoordinator } from './themeSessionCoordinator';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ChatMessage } from '../../types/domain';

function writableConversation(messages: ChatMessage[] = []): WritableConversationBody {
  return {
    conversationId: 'conv-1',
    conversation: {
      id: 'conv-1',
      title: '测试对话',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages
    },
    messages
  };
}

function previewToolMessage(): ChatMessage {
  return {
    id: 'tool-1',
    role: 'assistant',
    content: 'preview',
    timestamp: 1,
    toolInvocation: {
      id: 'tool-preview',
      kind: 'applyPreset',
      status: 'preview',
      title: '预览',
      summary: '预览',
      previewId: 'preview-1'
    }
  };
}

describe('createThemeSessionCoordinator', () => {
  it('finalizes a preview message when an external theme mutation resolves the active preview', () => {
    const updateMessage = vi.fn();
    let activePreview: {
      id: string;
      conversationId: string;
      before: {
        activePresetId: string | null;
        activeSavedSkinId: string | null;
        cssVariables: Record<string, string>;
        presetCSS: string;
        customCSS: string;
        generatedCSS: string;
      };
      pending: string;
    } | null = {
      id: 'preview-1',
      conversationId: 'conv-1',
      before: {
        activePresetId: 'before',
        activeSavedSkinId: null,
        cssVariables: { '--accent': '#111' },
        presetCSS: '',
        customCSS: '',
        generatedCSS: ''
      },
      pending: ''
    };

    const previewMessages = [previewToolMessage()];
    const coordinator = createThemeSessionCoordinator({
      chat: {
        getConversationWritable: () => writableConversation(previewMessages),
        updateMessage
      },
      state: {
        getActiveThemePreview: () => activePreview,
        getCurrentThemeFrame: () => ({
          activePresetId: 'after',
          activeSavedSkinId: null,
          cssVariables: { '--accent': '#222' },
          presetCSS: '',
          customCSS: '',
          generatedCSS: ''
        }),
        rollbackThemePreview: vi.fn(() => true)
      }
    });

    coordinator.runExternalThemeMutation(() => {
      activePreview = null;
    });

    expect(updateMessage).toHaveBeenCalledOnce();
    expect(updateMessage.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ conversationId: 'conv-1' }));
    expect(updateMessage.mock.calls[0]?.[1]).toBe('tool-1');
    expect(updateMessage.mock.calls[0]?.[2]).toMatchObject({
      toolInvocation: expect.objectContaining({ status: 'superseded' })
    });
  });

  it('rolls back the active preview when deleting its conversation', () => {
    const rollbackThemePreview = vi.fn(() => true);

    const coordinator = createThemeSessionCoordinator({
      chat: {
        getConversationWritable: () => writableConversation(),
        updateMessage: vi.fn()
      },
      state: {
        getActiveThemePreview: () => ({
          id: 'preview-1',
          conversationId: 'conv-1',
          before: {
            activePresetId: null,
            activeSavedSkinId: null,
            cssVariables: {},
            presetCSS: '',
            customCSS: '',
            generatedCSS: ''
          },
          pending: ''
        }),
        getCurrentThemeFrame: () => ({
          activePresetId: null,
          activeSavedSkinId: null,
          cssVariables: {},
          presetCSS: '',
          customCSS: '',
          generatedCSS: ''
        }),
        rollbackThemePreview
      }
    });

    expect(coordinator.rollbackPreviewForConversationDeletion('conv-1')).toBe(true);
    expect(rollbackThemePreview).toHaveBeenCalledWith('preview-1');
  });
});

describe('createThemePreviewCoordinator', () => {
  it('marks a preview tool message as applied', () => {
    const updateMessage = vi.fn();
    const previewMessages = [previewToolMessage()];
    const coordinator = createThemePreviewCoordinator({
      getConversationWritable: () => writableConversation(previewMessages),
      updateMessage
    });

    const didApply = coordinator.applyPreviewFromToolEvent(writableConversation(previewMessages), previewMessages[0]);

    expect(didApply).toBe(true);
    expect(updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1' }),
      'tool-1',
      expect.objectContaining({
        toolInvocation: expect.objectContaining({ status: 'applied' })
      })
    );
  });

  it('marks a preview tool message as rolled back', () => {
    const updateMessage = vi.fn();
    const previewMessages = [previewToolMessage()];
    const coordinator = createThemePreviewCoordinator({
      getConversationWritable: () => writableConversation(previewMessages),
      updateMessage
    });

    const didRollback = coordinator.rollbackPreview(writableConversation(previewMessages), 'preview-1');

    expect(didRollback).toBe(true);
    expect(updateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1' }),
      'tool-1',
      expect.objectContaining({
        content: '这次试穿已取消。',
        toolInvocation: expect.objectContaining({ status: 'rolled_back' })
      })
    );
  });
});
