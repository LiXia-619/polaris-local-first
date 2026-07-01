import { useEffect, useState } from 'react';
import { getDesktopLocalHostBridge } from '../../desktop/localHost';
import type { PolarisToolPromptGroup } from '../../engines/tool-protocol/assistantToolProtocolTypes';
import {
  getCachedNativePersonalDataStatus,
  refreshNativePersonalDataStatus,
  requestNativeCalendarAccess,
  type NativePersonalDataStatus
} from '../../native/personalData';
import { useChatStore } from '../../stores/chatStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { setTaskModeEnabledForConversations } from '../chat/taskModeToggle';
import type { ThemeToolMode } from '../../types/domain';
import { countEnabledVisibleToolboxGroups } from './menuToolboxGroups';

type MenuToolboxUi = {
  alert: (message: string) => void;
};

type UseMenuToolboxControllerArgs = {
  open: boolean;
  page: string;
  ui: MenuToolboxUi;
  toolPromptPreferences: Record<PolarisToolPromptGroup, boolean>;
  setToolPromptGroupEnabled: (group: PolarisToolPromptGroup, enabled: boolean) => void;
  setTaskModeEnabled: (enabled: boolean) => void;
  setThemeToolMode: (mode: ThemeToolMode) => void;
};

export function shouldRefreshMenuPersonalDataStatus(open: boolean, page: string) {
  return open && page === 'toolbox';
}

export function resolveThemeToolModeForToolboxToggle(
  group: PolarisToolPromptGroup,
  enabled: boolean,
  currentMode: ThemeToolMode
): ThemeToolMode | null {
  if (group !== 'theme') return null;
  if (!enabled) return 'off';
  return currentMode === 'off' ? 'stable' : null;
}

export function useMenuToolboxController({
  open,
  page,
  ui,
  toolPromptPreferences,
  setToolPromptGroupEnabled,
  setTaskModeEnabled,
  setThemeToolMode
}: UseMenuToolboxControllerArgs) {
  const [personalDataStatus, setPersonalDataStatus] = useState<NativePersonalDataStatus>(
    () => getCachedNativePersonalDataStatus()
  );

  useEffect(() => {
    if (!shouldRefreshMenuPersonalDataStatus(open, page)) return;
    void refreshNativePersonalDataStatus()
      .then(setPersonalDataStatus)
      .catch((error) => ui.alert(error instanceof Error ? error.message : '刷新系统资料状态失败'));
  }, [open, page]);

  const desktopLocalAvailable = Boolean(getDesktopLocalHostBridge());
  const enabledToolGroupsCount = countEnabledVisibleToolboxGroups(toolPromptPreferences, { desktopLocalAvailable });

  const setToolPromptGroupEnabledAndSyncTheme = (group: PolarisToolPromptGroup, enabled: boolean) => {
    setToolPromptGroupEnabled(group, enabled);
    if (group === 'personalData' && enabled) {
      void refreshNativePersonalDataStatus()
        .then(setPersonalDataStatus)
        .catch((error) => ui.alert(error instanceof Error ? error.message : '刷新系统资料状态失败'));
    }

    const nextThemeMode = resolveThemeToolModeForToolboxToggle(
      group,
      enabled,
      useSpaceStore.getState().theme.toolMode
    );
    if (nextThemeMode) {
      setThemeToolMode(nextThemeMode);
    }
  };

  const refreshPersonalDataStatus = async () => {
    try {
      setPersonalDataStatus(await refreshNativePersonalDataStatus());
    } catch (error) {
      ui.alert(error instanceof Error ? error.message : '刷新系统资料状态失败');
    }
  };

  const requestPersonalCalendarAccess = async () => {
    try {
      setPersonalDataStatus(await requestNativeCalendarAccess());
    } catch (error) {
      ui.alert(error instanceof Error ? error.message : '请求日历权限失败');
    }
  };

  const setTaskModeEnabledAndSyncCurrentTask = (enabled: boolean) => {
    const chatState = useChatStore.getState();
    setTaskModeEnabledForConversations({
      runtime: {
        setTaskModeEnabled
      },
      chat: {
        conversations: chatState.conversations,
        setConversationTask: chatState.setConversationTask
      }
    }, enabled);
  };

  return {
    personalDataStatus,
    desktopLocalAvailable,
    enabledToolGroupsCount,
    onRefreshPersonalDataStatus: refreshPersonalDataStatus,
    onRequestPersonalCalendarAccess: requestPersonalCalendarAccess,
    onSetToolPromptGroupEnabled: setToolPromptGroupEnabledAndSyncTheme,
    onSetTaskModeEnabled: setTaskModeEnabledAndSyncCurrentTask
  };
}
