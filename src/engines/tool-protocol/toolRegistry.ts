import {
  isPolarisNativeToolVisible
} from './toolVisibility';
import {
  POLARIS_TOOL_EXECUTOR_BY_ACTION_KIND,
  POLARIS_TOOL_MANIFEST_SEEDS,
  type PolarisToolExecutorPluginId
} from './toolManifest';
import { ATTACHMENT_TOOL_DEFINITION_MAP } from './toolRegistryAttachments';
import { CARD_TOOL_ALIAS_DEFINITIONS, CARD_TOOL_DEFINITION_MAP } from './toolRegistryCards';
import {
  THEME_TOOL_DEFINITION_MAP
} from './toolRegistryTheme';
import { DESKTOP_LOCAL_TOOL_DEFINITION_MAP } from './toolRegistryDesktopLocal';
import type { PolarisToolDefinition } from './toolRegistryShared';
import { UTILITY_TOOL_DEFINITION_MAP } from './toolRegistryUtilities';
import { resolveCardToolDefinitions } from './toolRegistryCardTools';
import { resolveMcpToolDefinitions } from './toolRegistryMcpTools';
import type { ToolInvocationKind } from '../../types/domain';
import type { AssistantToolActionKind, ToolActionKind } from '../toolActionTypes';
import type { AssistantToolContext } from './assistantToolProtocolTypes';
import { areAllUserFacingPolarisToolPromptGroupsDisabled } from './toolPromptPreferences';

export type {
  PolarisToolDefinition,
  PolarisRegistryToolGroup,
  PolarisToolFollowupDomain,
  PolarisToolResultReplayMode,
  ToolPromptContext
} from './toolRegistryShared';
export type { PolarisToolExecutorPluginId } from './toolManifest';

export type ToolResolutionSource = Partial<Pick<
  AssistantToolContext,
  | 'activeProject'
  | 'activeCard'
  | 'roomContextMode'
  | 'runtimeFeedback'
  | 'enabledToolGroups'
  | 'themeToolMode'
  | 'toolEnforcementScope'
  | 'taskMode'
  | 'imageGenerationAvailable'
  | 'memorySearchAvailable'
  | 'visibleCards'
  | 'attachmentSnapshot'
  | 'imageAssetSnapshot'
  | 'desktopLocalHost'
  | 'personalData'
  | 'mcpTools'
>>;

export const POLARIS_TOOL_REGISTRY_BY_NAME = {
  ...CARD_TOOL_DEFINITION_MAP,
  ...THEME_TOOL_DEFINITION_MAP,
  ...DESKTOP_LOCAL_TOOL_DEFINITION_MAP,
  ...ATTACHMENT_TOOL_DEFINITION_MAP,
  ...UTILITY_TOOL_DEFINITION_MAP
} satisfies Partial<Record<AssistantToolActionKind, PolarisToolDefinition>>;

type PolarisToolRegistryName = keyof typeof POLARIS_TOOL_REGISTRY_BY_NAME;

export type PolarisToolManifestEntry = {
  name: ToolInvocationKind;
  label: string;
  group?: PolarisToolDefinition['group'];
  followupDomain?: PolarisToolDefinition['followupDomain'];
  resultReplayMode?: PolarisToolDefinition['resultReplayMode'];
  executorPlugin?: PolarisToolExecutorPluginId;
  definition?: PolarisToolDefinition;
};

export const POLARIS_TOOL_REGISTRY: PolarisToolDefinition[] = Object.values(POLARIS_TOOL_REGISTRY_BY_NAME);
export const POLARIS_TOOL_REGISTRY_ALIASES: PolarisToolDefinition[] = [
  ...CARD_TOOL_ALIAS_DEFINITIONS
];

export function findPolarisToolDefinition(name: string): PolarisToolDefinition | undefined {
  if (!(name in POLARIS_TOOL_REGISTRY_BY_NAME)) {
    return undefined;
  }
  return POLARIS_TOOL_REGISTRY_BY_NAME[name as PolarisToolRegistryName];
}

export function findPolarisToolManifestEntry(name: string): PolarisToolManifestEntry | undefined {
  if (!(name in POLARIS_TOOL_MANIFEST_SEEDS)) {
    return undefined;
  }
  const toolName = name as ToolInvocationKind;
  const seed = POLARIS_TOOL_MANIFEST_SEEDS[toolName];
  const definition = findPolarisToolDefinition(name);
  return {
    name: toolName,
    label: definition?.label ?? seed.label,
    group: definition?.group ?? seed.group,
    followupDomain: definition?.followupDomain ?? seed.followupDomain,
    resultReplayMode: definition?.resultReplayMode ?? seed.resultReplayMode,
    executorPlugin: name in POLARIS_TOOL_EXECUTOR_BY_ACTION_KIND
      ? POLARIS_TOOL_EXECUTOR_BY_ACTION_KIND[name as ToolActionKind]
      : undefined,
    definition
  };
}

export function resolveAvailablePolarisTools(context?: ToolResolutionSource) {
  if (areAllUserFacingPolarisToolPromptGroupsDisabled(
    context?.enabledToolGroups,
    context?.toolEnforcementScope
  )) {
    return [];
  }

  return [
    ...POLARIS_TOOL_REGISTRY,
    ...POLARIS_TOOL_REGISTRY_ALIASES,
    ...resolveCardToolDefinitions(context),
    ...resolveMcpToolDefinitions(context)
  ].filter((tool) => isPolarisNativeToolVisible(tool, context));
}

export function isPolarisToolExposedAsNative(tool: PolarisToolDefinition) {
  return tool.exposeAsNative !== false;
}

export function resolveAvailablePolarisToolNames(context?: ToolResolutionSource) {
  return new Set(resolveAvailablePolarisTools(context).map((tool) => tool.name));
}

export function findAvailablePolarisToolDefinition(name: string, context?: ToolResolutionSource) {
  return resolveAvailablePolarisTools(context).find((tool) => tool.name === name);
}
