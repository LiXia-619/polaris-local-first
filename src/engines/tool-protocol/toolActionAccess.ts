import type {
  AssistantToolAction,
  AssistantToolContext,
  PolarisToolPromptGroup
} from './assistantToolProtocolTypes';
import {
  resolvePolarisPromptGroup
} from './toolAvailability';
import { findPolarisToolDefinition } from './toolRegistry';
import { isParsedAssistantActionVisible } from './toolVisibility';

type ToolActionAccessContext = Pick<
  AssistantToolContext,
  | 'enabledToolGroups'
  | 'themeToolMode'
  | 'toolEnforcementScope'
  | 'desktopLocalHost'
  | 'imageGenerationAvailable'
  | 'memorySearchAvailable'
  | 'attachmentSnapshot'
  | 'imageAssetSnapshot'
  | 'personalData'
> & {
  activeProjectId?: string | null;
  availableToolNames?: ReadonlySet<string>;
};

function resolveRegistryLookupKind(kind: AssistantToolAction['kind']) {
  return kind;
}

export function resolveAssistantActionAccess(
  action: Pick<AssistantToolAction, 'kind'>,
  context?: ToolActionAccessContext
): {
  promptGroup: PolarisToolPromptGroup;
  visible: boolean;
} {
  const visibleInCurrentToolSet = context?.availableToolNames
    ? context.availableToolNames.has(action.kind)
    : true;

  if (action.kind === 'startTask') {
    return {
      promptGroup: 'generation',
      visible: visibleInCurrentToolSet && isParsedAssistantActionVisible({
        actionKind: action.kind,
        context
      })
    };
  }

  const tool = findPolarisToolDefinition(resolveRegistryLookupKind(action.kind));
  if (!tool) {
    return {
      promptGroup: 'room',
      visible: false
    };
  }

  return {
    promptGroup: resolvePolarisPromptGroup(tool.group),
    visible: visibleInCurrentToolSet && isParsedAssistantActionVisible({
      actionKind: action.kind,
      tool,
      context
    })
  };
}
