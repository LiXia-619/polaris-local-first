import type { PolarisToolPromptGroup } from '../engines/tool-protocol/assistantToolProtocolTypes';
import { DEFAULT_POLARIS_TOOL_PROMPT_PREFERENCES } from '../engines/tool-protocol/toolPromptPreferences';

export type RuntimeToolboxState = {
  toolPromptPreferences: Record<PolarisToolPromptGroup, boolean>;
  taskModeEnabled: boolean;
};

export const DEFAULT_RUNTIME_TOOLBOX_STATE: RuntimeToolboxState = {
  toolPromptPreferences: {
    ...DEFAULT_POLARIS_TOOL_PROMPT_PREFERENCES
  },
  taskModeEnabled: false
};

export function normalizeRuntimeToolboxState(
  state?: (Partial<RuntimeToolboxState> & { forceToolUse?: boolean }) | null
): RuntimeToolboxState {
  return {
    toolPromptPreferences: {
      ...DEFAULT_POLARIS_TOOL_PROMPT_PREFERENCES,
      ...state?.toolPromptPreferences
    },
    taskModeEnabled: state?.taskModeEnabled ?? state?.forceToolUse ?? false
  };
}
