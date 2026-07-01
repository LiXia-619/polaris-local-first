import type { ChatMessage } from '../../types/domain';
import type { ToolAction } from '../../engines/toolExecutor';
import type {
  AddRuntimeToolMessage,
  ChatSpaceFrontstagePort,
  ChatSpaceThemeSessionPort,
  ChatToolStoreBindings,
  ChatToolDerivedState,
  MemoryActions,
  ToolActionChatState,
  ToolActionCollectionState,
  ToolActionLocalState,
  ToolActionSpaceState
} from './chatPorts';

export type {
  AddRuntimeToolMessage,
  ChatSpaceFrontstagePort,
  ChatSpaceThemeSessionPort,
  ChatToolStoreBindings,
  MemoryActions,
  ToolActionChatState,
  ToolActionCollectionState,
  ToolActionLocalState,
  ToolActionSpaceState
} from './chatPorts';

export type ToolActionDerivedState = ChatToolDerivedState;

export type ToolActionRunnerArgs = {
  local: ToolActionLocalState;
  chat: ToolActionChatState;
  persona: ChatToolStoreBindings['persona'];
  collection: ToolActionCollectionState;
  runtime: ChatToolStoreBindings['runtime'];
  space: ToolActionSpaceState;
  derived: ToolActionDerivedState;
  memoryActions: MemoryActions;
  addRuntimeToolMessage: AddRuntimeToolMessage;
};

export type ToolPreviewMessageHandler = (message: ChatMessage) => void;
export type ToolPreviewAction = ToolAction;

export type AssistantWorkspaceExecutionMode =
  | 'execute-approved';

export type AssistantToolActionBatchOptions = {
  beforeMessageId?: string;
  toolCallIds?: string[];
  workspaceExecutionMode?: AssistantWorkspaceExecutionMode;
  signal?: AbortSignal;
};
