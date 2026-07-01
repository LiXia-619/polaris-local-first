import { useMemo } from 'react';
import { DEFAULT_THEME_PRESET_ID } from '../../config/theme/themePresets';
import { useChatStore } from '../../stores/chatStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useSpaceThemeSessionBindings } from '../../stores/spaceStoreThemeSessionBindings';
import { toThemeFrame } from '../../stores/spaceStoreTheme';
import { createThemeSessionCoordinator } from './themeSessionCoordinator';

export function useThemeSessionActions() {
  const themeSession = useSpaceThemeSessionBindings();
  const coordinator = useMemo(() => createThemeSessionCoordinator({
    chat: {
      getConversationWritable: (conversationId) => useChatStore.getState().getConversationWritable(conversationId),
      updateMessage: (target, messageId, patch) => {
        useChatStore.getState().updateMessage(target, messageId, patch);
      }
    },
    state: {
      getActiveThemePreview: () => useSpaceStore.getState().activeThemePreview,
      getCurrentThemeFrame: () => toThemeFrame(useSpaceStore.getState().theme),
      rollbackThemePreview: (previewId) => themeSession.rollbackThemePreview(previewId)
    }
  }), [themeSession]);

  return useMemo(() => ({
    applyThemePreset: (presetId: string) =>
      coordinator.runExternalThemeMutation(() => {
        themeSession.applyThemePreset(presetId);
      }),
    enterCustomThemeMode: () =>
      coordinator.runExternalThemeMutation(() => {
        themeSession.enterCustomThemeMode();
      }),
    applySavedSkin: (savedSkinId: string) =>
      coordinator.runExternalThemeMutation(() => {
        themeSession.applySavedSkin(savedSkinId);
      }),
    applyCustomCss: (customCSS: string) =>
      coordinator.runExternalThemeMutation(() => {
        const trimmed = customCSS.trim();
        const currentTheme = useSpaceStore.getState().theme;
        if (!trimmed) {
          if (currentTheme.customCSS.trim()) {
            themeSession.commitSkinSnapshot();
          }
          themeSession.clearCustomCSS();
          return;
        }
        if (currentTheme.customCSS !== trimmed || currentTheme.activeSavedSkinId) {
          themeSession.commitSkinSnapshot();
        }
        themeSession.setCustomCSS(trimmed);
      }),
    applyLiveCustomCss: (customCSS: string, options?: { snapshotBeforeChange?: boolean }) =>
      coordinator.runExternalThemeMutation(() => {
        const trimmed = customCSS.trim();
        const currentTheme = useSpaceStore.getState().theme;
        if (!trimmed) {
          if (currentTheme.customCSS.trim() || currentTheme.activeSavedSkinId) {
            themeSession.setCustomCSS('');
          }
          return;
        }
        if (options?.snapshotBeforeChange && (currentTheme.customCSS !== trimmed || currentTheme.activeSavedSkinId)) {
          themeSession.commitSkinSnapshot();
        }
        themeSession.setCustomCSS(trimmed);
      }),
    setCustomCSS: (customCSS: string) =>
      coordinator.runExternalThemeMutation(() => {
        themeSession.setCustomCSS(customCSS);
      }),
    clearCustomCSS: () =>
      coordinator.runExternalThemeMutation(() => {
        if (themeSession.theme.customCSS.trim()) {
          themeSession.commitSkinSnapshot();
        }
        themeSession.clearCustomCSS();
      }),
    restoreDefaultTheme: () =>
      coordinator.runExternalThemeMutation(() => {
        themeSession.applyThemePreset(DEFAULT_THEME_PRESET_ID);
      }),
    restoreSkinSnapshot: (snapshotId: string) =>
      coordinator.runExternalThemeMutation(() => {
        themeSession.restoreSkinSnapshot(snapshotId);
      }),
    rollbackLastSkin: () =>
      coordinator.runExternalThemeMutation(() => {
        themeSession.rollbackLastSkin();
      }),
    rollbackPreviewForConversationDeletion: coordinator.rollbackPreviewForConversationDeletion
  }), [coordinator, themeSession]);
}
