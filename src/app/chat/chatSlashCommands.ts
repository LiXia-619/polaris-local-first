import { isDeveloperModeEnabled, setDeveloperModeEnabled } from '../developer/developerModeRuntime';
import { createMessage } from '../../engines/chatMessageFactory';
import { createConversationTaskShell } from '../../engines/conversationTask';
import { isPolarisToolPromptGroupEnabled } from '../../engines/tool-protocol/toolPromptPreferences';
import { extractCodeBlocksFromMessage } from '../../engines/codeCardEngine';
import type { LocalToolCommand, ToolAction } from '../../engines/toolExecutorTypes';
import type { ChatMessage } from '../../types/domain';
import type { ChatDerivedState } from './chatDerivedState';
import type { ChatStoreBindings } from './useChatStoreBindings';
import type { ToolActions } from './chatToolActions';
import type { ChatReplyRunResult } from './chatReplyRuntime';
import {
  formatEnvironmentContractQaReport,
  readLatestEnvironmentContractQaReport,
  runEnvironmentContractQa
} from './chatEnvironmentContractQa';
import { runInAppLongWorkflowQa } from './chatInAppLongWorkflowQa';
import { ensureConversationSession, openConversationForCollaborator } from './chatConversationSession';
import { formatConversationJson, formatConversationMarkdown } from './chatSlashCommandExports';
import { findProviderForSlashCommand } from './chatProviderSlashCommands';
import {
  buildContextSummary,
  cloneMessageForFork,
  findLatestUserMessageIndex,
  latestAssistantMessage,
  normalizeLookupText,
  saveNoteCard
} from './chatSlashCommandSupport';
import { selectChatConversations } from './liveConversationCatalog';

type CreateChatSlashCommandHandlerArgs = {
  ui: {
    sending: boolean;
    setCommandStatus: (text: string, isError?: boolean) => void;
  };
  store: ChatStoreBindings;
  derived: ChatDerivedState;
  toolActions: ToolActions;
  runReply: (params: {
    conversationId: string;
    collaboratorId: string;
    messages: ChatMessage[];
  }) => Promise<ChatReplyRunResult>;
};

export function createChatSlashCommandHandler({
  ui,
  store,
  derived,
  toolActions,
  runReply
}: CreateChatSlashCommandHandlerArgs) {
  const clearCommandInput = () => {
    store.chat.setInputDraft('');
  };

  const runToolActionCommand = (action: ToolAction) => {
    toolActions.submitToolAction(action);
    clearCommandInput();
  };

  const runRetry = async (command: Extract<LocalToolCommand, { kind: 'retryLatestAssistant' }>) => {
    const activeConversation = derived.activeConversation;
    if (!activeConversation || ui.sending) return;
    if (activeConversation.collaboratorId === null) {
      ui.setCommandStatus('这条对话已经失去归属，只能查看历史，不能在原线程里重新生成。', true);
      return;
    }

    const writableConversation = await store.chat.ensureConversationWritable(activeConversation.id);
    if (!writableConversation) {
      ui.setCommandStatus('读取当前对话历史失败，先别重跑，避免用空历史继续。', true);
      return;
    }
    const assistant = latestAssistantMessage(writableConversation.messages);
    if (!assistant) {
      ui.setCommandStatus('还没有可以重跑的上一条回复。', true);
      return;
    }
    const messageIndex = writableConversation.messages.findIndex((message) => message.id === assistant.id);
    if (messageIndex <= 0) return;

    const baseMessages = writableConversation.messages.slice(0, messageIndex);
    const instruction = command.instruction?.trim();
    const nextMessages = instruction
      ? [
          ...baseMessages,
          createMessage('user', `重新生成上一条回复，要求：${instruction}`, undefined, 'user-input')
        ]
      : baseMessages;
    store.chat.replaceConversationMessages(writableConversation, nextMessages);
    clearCommandInput();
    await runReply({
      conversationId: activeConversation.id,
      collaboratorId: derived.activeCollaboratorSourceId ?? activeConversation.collaboratorId,
      messages: nextMessages
    });
  };

  const runUndo = async () => {
    const activeConversation = derived.activeConversation;
    if (!activeConversation) {
      ui.setCommandStatus('当前没有可以撤回的对话。', true);
      return;
    }

    const writableConversation = await store.chat.ensureConversationWritable(activeConversation.id);
    if (!writableConversation) {
      ui.setCommandStatus('读取当前对话历史失败，先别撤回，避免用空历史继续。', true);
      return;
    }
    const latestUserIndex = findLatestUserMessageIndex(writableConversation.messages);
    if (latestUserIndex < 0) {
      ui.setCommandStatus('还没有可以撤回的用户消息。', true);
      return;
    }

    const removedMessages = writableConversation.messages.slice(latestUserIndex);
    store.chat.replaceConversationMessages(writableConversation, writableConversation.messages.slice(0, latestUserIndex));
    const task = store.chat.getConversationTask(activeConversation.id);
    if (task && removedMessages.some((message) => message.id === task.sourceMessageId)) {
      store.chat.setConversationTask(activeConversation.id, null);
    }
    clearCommandInput();
    ui.setCommandStatus('已撤回最后一轮消息。');
  };

  const runFork = async () => {
    const activeConversation = derived.activeConversation;
    if (!activeConversation) {
      ui.setCommandStatus('当前没有可以分叉的对话。', true);
      return;
    }
    const sourceConversation = await store.chat.ensureConversationWritable(activeConversation.id);
    if (!sourceConversation) {
      ui.setCommandStatus('读取当前对话历史失败，先别分叉。', true);
      return;
    }
    const conversationId = store.chat.createConversation(sourceConversation.conversation.collaboratorId ?? undefined, {
      activeProjectId: sourceConversation.conversation.activeProjectId ?? null
    });
    const writableConversation = await store.chat.ensureConversationWritable(conversationId);
    if (!writableConversation) {
      ui.setCommandStatus('新分叉还没准备好，先别写入。', true);
      return;
    }
    store.chat.replaceConversationMessages(
      writableConversation,
      sourceConversation.messages.map(cloneMessageForFork)
    );
    store.chat.setActiveConversation(conversationId);
    clearCommandInput();
    ui.setCommandStatus(`已分叉：${activeConversation.title}`);
  };

  const runTogglePin = () => {
    const activeConversation = derived.activeConversation;
    if (!activeConversation) {
      ui.setCommandStatus('当前没有可以置顶的对话。', true);
      return;
    }
    const willPin = !activeConversation.pinnedAt;
    store.chat.toggleConversationPinned(activeConversation.id);
    clearCommandInput();
    ui.setCommandStatus(willPin ? '已置顶当前对话。' : '已取消置顶当前对话。');
  };

  const runRenameConversation = (command: Extract<LocalToolCommand, { kind: 'renameConversation' }>) => {
    const activeConversation = derived.activeConversation;
    if (!activeConversation) {
      ui.setCommandStatus('当前没有可以重命名的对话。', true);
      return;
    }
    store.chat.renameConversation(activeConversation.id, command.title);
    clearCommandInput();
    ui.setCommandStatus(`已重命名为：${command.title}`);
  };

  const runExportConversation = (command: Extract<LocalToolCommand, { kind: 'exportConversation' }>) => {
    const activeConversation = derived.activeConversation;
    if (!activeConversation) {
      ui.setCommandStatus('当前没有可以导出的对话。', true);
      return;
    }
    if (activeConversation.messages.length === 0) {
      ui.setCommandStatus('当前对话还是空的。', true);
      return;
    }
    const format = command.format;
    const content = format === 'json'
      ? formatConversationJson({
          conversationId: activeConversation.id,
          title: activeConversation.title,
          messages: activeConversation.messages
        })
      : formatConversationMarkdown({
          title: activeConversation.title,
          messages: activeConversation.messages
        });

    saveNoteCard({
      store,
      derived,
      content,
      title: `${activeConversation.title || '对话'} 导出`,
      language: format,
      originMessage: null,
      tags: ['dialogue', 'export', format]
    });
    clearCommandInput();
    ui.setCommandStatus(`已导出当前对话为 ${format} 卡片。`);
  };

  const runSwitchPersona = (command: Extract<LocalToolCommand, { kind: 'switchPersona' }>) => {
    const targetName = normalizeLookupText(command.name);
    const target = store.persona.personas.find((persona) =>
      normalizeLookupText(persona.id) === targetName || normalizeLookupText(persona.name) === targetName
    ) ?? null;
    if (!target) {
      ui.setCommandStatus(`没有找到人格：${command.name}`, true);
      return;
    }

    store.persona.setActiveCollaborator(target.id);
    store.space.setFrontstageCollaboratorId(target.id);
    const chatState = store.chat.readLatestState();
    const resolution = openConversationForCollaborator({
      conversations: selectChatConversations(chatState.conversations),
      personas: store.persona.personas,
      activeCollaboratorId: target.id
    }, {
      createConversation: store.chat.createConversation,
      setActiveConversation: store.chat.setActiveConversation,
      clearPendingCardReference: store.space.clearPendingCardReference,
      clearPendingAttachments: store.space.clearPendingAttachments
    }, target.id);
    store.space.setWorld('chat');
    clearCommandInput();
    ui.setCommandStatus(resolution.created ? `已切到 ${target.name}，并新建对话。` : `已切到 ${target.name}。`);
  };

  const runSwitchProvider = (command: Extract<LocalToolCommand, { kind: 'switchProvider' }>) => {
    const runtimeState = store.runtime.readLatestState();
    const target = findProviderForSlashCommand(runtimeState.providers ?? store.runtime.providers, command.query);
    if (!target) {
      ui.setCommandStatus(`没有找到供应商线路：${command.query}`, true);
      return;
    }

    store.runtime.setActiveProvider(target.id);
    clearCommandInput();
    ui.setCommandStatus(`已切到供应商：${target.name || target.id}`);
  };

  const runSetActiveModel = (command: Extract<LocalToolCommand, { kind: 'setActiveModel' }>) => {
    const runtimeState = store.runtime.readLatestState();
    const activeProvider = runtimeState.api ?? store.runtime.api;
    store.runtime.updateProvider(activeProvider.id, { model: command.model });
    clearCommandInput();
    ui.setCommandStatus(`已把 ${activeProvider.name || activeProvider.id} 的模型切到：${command.model}`);
  };

  const runBindWorkspace = (command: Extract<LocalToolCommand, { kind: 'bindWorkspace' }>) => {
    const query = normalizeLookupText(command.projectName);
    const project = store.collection.roomProjects.find((entry) =>
      normalizeLookupText(entry.id) === query
      || normalizeLookupText(entry.slug) === query
      || normalizeLookupText(entry.title) === query
    ) ?? null;
    if (!project) {
      ui.setCommandStatus(`没有找到工作区：${command.projectName}`, true);
      return;
    }

    const chatState = store.chat.readLatestState();
    const personaState = store.persona.readLatestState();
    const spaceState = store.space.readLatestState();
    const liveConversations = selectChatConversations(chatState.conversations);
    const activeConversation = chatState.activeConversationId
      ? liveConversations.find((conversation) => conversation.id === chatState.activeConversationId) ?? null
      : null;
    const session = ensureConversationSession(
      {
        activeConversation,
        activeCollaboratorId: spaceState.frontstageCollaboratorId ?? personaState.activeCollaboratorId,
        personas: personaState.personas
      },
      {
        createConversation: store.chat.createConversation
      }
    );
    if (!session) {
      ui.setCommandStatus('当前没有可用协作者，先新建一个协作者再绑定工作区。', true);
      return;
    }
    store.chat.setConversationActiveProject(session.conversationId, project.id);
    clearCommandInput();
    ui.setCommandStatus(`已绑定工作区：${project.title}`);
  };

  const runSaveLatestCodeCard = () => {
    const activeConversation = derived.activeConversation;
    const assistant = activeConversation ? latestAssistantMessage(activeConversation.messages) : null;
    if (!assistant) {
      ui.setCommandStatus('还没有可以保存的上一条回复。', true);
      return;
    }
    if (extractCodeBlocksFromMessage(assistant.content).length === 0) {
      ui.setCommandStatus('上一条回复里没有代码块。', true);
      return;
    }
    toolActions.saveMessageCodeCard(assistant);
    clearCommandInput();
  };

  const runSaveLatestNote = (command: Extract<LocalToolCommand, { kind: 'saveLatestNote' }>) => {
    const activeConversation = derived.activeConversation;
    const assistant = activeConversation ? latestAssistantMessage(activeConversation.messages) : null;
    const content = command.note?.trim() || assistant?.content.trim() || '';
    if (!content) {
      ui.setCommandStatus('还没有可以保存的内容。', true);
      return;
    }
    saveNoteCard({
      store,
      derived,
      content,
      title: command.note ? '手记' : '上一条回复笔记',
      originMessage: command.note ? null : assistant,
      tags: ['note', 'chat']
    });
    clearCommandInput();
    ui.setCommandStatus('已存成笔记卡。');
  };

  const runTask = async (command: Extract<LocalToolCommand, { kind: 'startTask' }>) => {
    if (ui.sending) return;
    if (!isPolarisToolPromptGroupEnabled(store.runtime.readLatestState().toolPromptPreferences, 'task')) {
      ui.setCommandStatus('任务工具已关闭；打开工具箱里的任务开关后再启动任务。', true);
      return;
    }
    const chatState = store.chat.readLatestState();
    const personaState = store.persona.readLatestState();
    const spaceState = store.space.readLatestState();
    const liveConversations = selectChatConversations(chatState.conversations);
    const activeConversation = chatState.activeConversationId
      ? liveConversations.find((conversation) => conversation.id === chatState.activeConversationId) ?? null
      : null;
    const session = ensureConversationSession(
      {
        activeConversation,
        activeCollaboratorId: spaceState.frontstageCollaboratorId ?? personaState.activeCollaboratorId,
        personas: personaState.personas
      },
      {
        createConversation: store.chat.createConversation
      }
    );
    if (!session) {
      ui.setCommandStatus('当前没有可用协作者，先新建一个协作者再启动任务。', true);
      return;
    }
    const userMessage = createMessage('user', command.goal, undefined, 'user-input');
    const writableConversation = await store.chat.ensureConversationWritable(session.conversationId);
    if (!writableConversation) {
      ui.setCommandStatus('读取当前对话历史失败，先别启动任务。', true);
      return;
    }
    const nextMessages = [...writableConversation.messages, userMessage];
    const task = createConversationTaskShell({ sourceMessage: userMessage, mode: 'active' });

    store.runtime.setTaskModeEnabled(true);
    store.chat.addMessage(writableConversation, userMessage);
    store.chat.setConversationTask(session.conversationId, task);
    clearCommandInput();
    await runReply({
      conversationId: session.conversationId,
      collaboratorId: session.collaboratorId,
      messages: nextMessages
    });
  };

  const runDebugLast = async () => {
    setDeveloperModeEnabled(true);
    const { readRequestDebugEntries } = await import('../../engines/request/requestDebugRuntime');
    const entries = readRequestDebugEntries();
    const latest = entries[entries.length - 1] ?? null;
    clearCommandInput();
    if (!latest) {
      ui.setCommandStatus('已打开 request debug；下一轮请求会开始记录。');
      return;
    }
    ui.setCommandStatus(
      `request debug：${latest.phase}｜${latest.assistantName}｜${latest.modelId}｜prompt ${latest.promptParts.length}｜tools ${latest.tooling.toolNames.length}`
    );
  };

  const runEnvironmentContractQaReport = () => {
    const report = readLatestEnvironmentContractQaReport();
    clearCommandInput();
    if (!report) {
      ui.setCommandStatus('还没有环境契约 QA 报告。先跑 /qa env。', true);
      return;
    }
    saveNoteCard({
      store,
      derived,
      content: formatEnvironmentContractQaReport(report),
      title: 'Polaris 环境契约 QA 报告',
      language: 'markdown',
      originMessage: null,
      tags: ['qa', 'environment', 'report']
    });
    ui.setCommandStatus(
      `已存环境契约 QA 报告：pass ${report.passCount}，warn ${report.warnCount}，fail ${report.failCount}。`
    );
  };

  const runLocalCommand = async (command: LocalToolCommand) => {
    switch (command.kind) {
      case 'retryLatestAssistant':
        return runRetry(command);
      case 'undoLatestTurn':
        return runUndo();
      case 'forkConversation':
        return runFork();
      case 'toggleConversationPin':
        runTogglePin();
        return;
      case 'renameConversation':
        runRenameConversation(command);
        return;
      case 'exportConversation':
        runExportConversation(command);
        return;
      case 'switchPersona':
        runSwitchPersona(command);
        return;
      case 'switchProvider':
        runSwitchProvider(command);
        return;
      case 'setActiveModel':
        runSetActiveModel(command);
        return;
      case 'bindWorkspace':
        runBindWorkspace(command);
        return;
      case 'saveLatestCodeCard':
        runSaveLatestCodeCard();
        return;
      case 'saveLatestNote':
        runSaveLatestNote(command);
        return;
      case 'startTask':
        return runTask(command);
      case 'showContext':
        clearCommandInput();
        ui.setCommandStatus(buildContextSummary({ store, derived }));
        return;
      case 'showLastDebug':
        return runDebugLast();
      case 'runLongWorkflowQa':
        return runInAppLongWorkflowQa({
          ui,
          store,
          derived,
          runReply
        });
      case 'runEnvironmentContractQa':
        return runEnvironmentContractQa({
          ui,
          store,
          derived,
          runReply
        });
      case 'showEnvironmentContractQaReport':
        runEnvironmentContractQaReport();
        return;
      case 'rememberNote':
        saveNoteCard({
          store,
          derived,
          content: command.note,
          title: '记忆笔记',
          originMessage: null,
          tags: ['memory', 'note']
        });
        clearCommandInput();
        ui.setCommandStatus('已存成记忆笔记卡；不会写入协作者长期记忆。');
        return;
      case 'exitWorkspace': {
        const conversationId = derived.activeConversation?.id;
        const activeProjectId = derived.activeConversation?.activeProjectId ?? null;
        if (!conversationId || !activeProjectId) {
          ui.setCommandStatus('当前对话没有绑定工作区。', true);
          return;
        }
        store.chat.setConversationActiveProject(conversationId, null);
        clearCommandInput();
        ui.setCommandStatus('已退出当前工作区。');
        return;
      }
    }
  };

  return async (rawInput: string) => {
    const { isDeveloperOnlyToolCommandResult, parseToolCommand } = await import('../../engines/toolExecutorCommands');
    const result = parseToolCommand(rawInput);
    if (!result) return false;
    if (isDeveloperOnlyToolCommandResult(result) && !isDeveloperModeEnabled()) {
      ui.setCommandStatus('这是 Polaris 开发者诊断指令，普通聊天里不会执行。', true);
      return true;
    }
    if (!result.ok) {
      ui.setCommandStatus(`命令错误：${result.error}`, true);
      return true;
    }
    if ('action' in result) {
      runToolActionCommand(result.action);
      return true;
    }
    await runLocalCommand(result.command);
    return true;
  };
}
