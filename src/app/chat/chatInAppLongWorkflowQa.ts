import { setDeveloperModeEnabled } from '../developer/developerModeRuntime';
import { clearRequestDebugEntries } from '../../engines/request/requestDebugRuntime';
import { clearChatQaAuditEntries, summarizeChatQaAuditEntries } from './chatQaAuditRuntime';
import { clearModelFlowTraceEntries, summarizeModelFlowTraceEntries } from './modelFlowTraceRuntime';
import { createMessage } from '../../engines/chatMessageFactory';
import type { ChatMessage, CodeCardFileRole } from '../../types/domain';
import type { ChatDerivedState } from './chatDerivedState';
import type { ChatStoreBindings } from './useChatStoreBindings';
import type { ChatReplyRunResult } from './chatReplyRuntime';

const LONG_WORKFLOW_QA_PROJECT_ID = 'qa-long-diary-workspace';
const LONG_WORKFLOW_QA_PROJECT_TITLE = 'QA 长任务日记工作区';

const LONG_WORKFLOW_QA_PROMPTS = [
  'Polaris 内置长任务 QA 第一阶段：当前对话已经绑定到工作区「QA 长任务日记工作区」。请把工作区改成一个可运行的多文件日记应用，至少要有入口页面、样式和脚本；页面需要日记列表、正文阅读区、编辑入口和保存入口。可以先读取现有文件，但不要新建普通房间卡，不要改别的工作区。',
  'Polaris 内置长任务 QA 第二阶段：在刚才的日记应用基础上继续加搜索、标签筛选、草稿状态和 localStorage 持久化。继续使用当前工作区工具，不要改成普通聊天回答。',
  'Polaris 内置长任务 QA 第三阶段：继续完善移动端体验和空状态，再检查入口文件引用是否自洽；如果发现缺文件或引用不一致，请直接修。'
];

type RunInAppLongWorkflowQaArgs = {
  ui: {
    sending: boolean;
    setCommandStatus: (text: string, isError?: boolean) => void;
  };
  store: ChatStoreBindings;
  derived: ChatDerivedState;
  runReply: (params: {
    conversationId: string;
    collaboratorId: string;
    messages: ChatMessage[];
  }) => Promise<ChatReplyRunResult>;
};

function resolveQaCollaboratorId(args: {
  store: ChatStoreBindings;
  derived: ChatDerivedState;
}) {
  const personaState = args.store.persona.readLatestState();
  const spaceState = args.store.space.readLatestState();
  return (
    spaceState.frontstageCollaboratorId
    ?? personaState.activeCollaboratorId
    ?? args.derived.persona?.id
    ?? personaState.personas[0]?.id
    ?? null
  );
}

function upsertQaProjectFile(args: {
  store: ChatStoreBindings;
  projectId: string;
  filePath: string;
  language: string;
  content: string;
  fileRole?: CodeCardFileRole;
  ownerCollaboratorId?: string;
}) {
  const existing = args.store.collection
    .readLatestState()
    .projectFiles
    .find((file) => file.projectId === args.projectId && file.filePath === args.filePath);
  if (existing) {
    args.store.collection.updateProjectFile(existing.id, {
      language: args.language,
      content: args.content,
      fileRole: args.fileRole,
      ownerCollaboratorId: args.ownerCollaboratorId,
      source: 'manual'
    });
    return existing.id;
  }

  return args.store.collection.createProjectFile({
    projectId: args.projectId,
    filePath: args.filePath,
    language: args.language,
    content: args.content,
    fileRole: args.fileRole,
    ownerCollaboratorId: args.ownerCollaboratorId,
    source: 'manual'
  });
}

function prepareQaWorkspace(store: ChatStoreBindings, ownerCollaboratorId: string) {
  const projectId = store.collection.createProject({
    id: LONG_WORKFLOW_QA_PROJECT_ID,
    title: LONG_WORKFLOW_QA_PROJECT_TITLE,
    slug: 'qa-long-diary-workspace',
    tags: ['qa', 'long-workflow'],
    ownerCollaboratorId,
    source: 'manual'
  });
  store.collection.updateProject(projectId, { ownerCollaboratorId });

  upsertQaProjectFile({
    store,
    projectId,
    filePath: 'index.html',
    language: 'html',
    fileRole: 'entry',
    ownerCollaboratorId,
    content: '<main><h1>QA 长任务日记</h1><p>等待 Polaris 内置长任务测试改造。</p></main>'
  });
  upsertQaProjectFile({
    store,
    projectId,
    filePath: 'styles.css',
    language: 'css',
    fileRole: 'style',
    ownerCollaboratorId,
    content: ':root { color-scheme: light; }\nbody { margin: 0; font-family: system-ui, sans-serif; }'
  });
  upsertQaProjectFile({
    store,
    projectId,
    filePath: 'script.js',
    language: 'javascript',
    fileRole: 'logic',
    ownerCollaboratorId,
    content: 'const entries = [];\nconsole.log("QA diary seed", entries);'
  });

  return projectId;
}

async function clearQaDebugLogs() {
  clearRequestDebugEntries();
  clearChatQaAuditEntries();
  clearModelFlowTraceEntries();
}

export async function runInAppLongWorkflowQa({
  ui,
  store,
  derived,
  runReply
}: RunInAppLongWorkflowQaArgs) {
  if (ui.sending) {
    ui.setCommandStatus('当前还有回复在生成，等它结束后再跑 Polaris 内置长任务 QA。', true);
    return;
  }

  const collaboratorId = resolveQaCollaboratorId({ store, derived });
  if (!collaboratorId) {
    ui.setCommandStatus('没有可用协作者，先新建或选择一个协作者再跑长任务 QA。', true);
    return;
  }

  setDeveloperModeEnabled(true);
  await clearQaDebugLogs();
  store.runtime.setTaskModeEnabled(true);
  store.runtime.setToolPromptGroupEnabled('project', true);

  const projectId = prepareQaWorkspace(store, collaboratorId);
  const conversationId = store.chat.createConversation(collaboratorId, {
    activeProjectId: projectId
  });
  store.chat.setActiveConversation(conversationId);
  store.chat.setConversationActiveProject(conversationId, projectId);
  store.space.setWorld('chat');
  store.space.clearPendingAttachments();
  store.space.clearPendingCardReference();

  for (let index = 0; index < LONG_WORKFLOW_QA_PROMPTS.length; index += 1) {
    const prompt = LONG_WORKFLOW_QA_PROMPTS[index];
    const writableConversation = await store.chat.ensureConversationWritable(conversationId);
    if (!writableConversation) {
      ui.setCommandStatus('Polaris 长任务 QA 无法读取对话历史，已停止。', true);
      return;
    }
    const userMessage = createMessage('user', prompt, undefined, 'user-input');
    const nextMessages = [
      ...writableConversation.messages,
      userMessage
    ];
    store.chat.addMessage(writableConversation, userMessage);
    ui.setCommandStatus(`Polaris 长任务 QA：第 ${index + 1}/${LONG_WORKFLOW_QA_PROMPTS.length} 阶段正在跑。`);
    const replyResult = await runReply({
      conversationId,
      collaboratorId,
      messages: nextMessages
    });
    if (replyResult.status === 'aborted') {
      ui.setCommandStatus(`已停止 Polaris 长任务 QA：停在第 ${index + 1}/${LONG_WORKFLOW_QA_PROMPTS.length} 阶段。`, true);
      return;
    }
  }

  const traceSummary = summarizeModelFlowTraceEntries();
  const qaSummary = summarizeChatQaAuditEntries();
  ui.setCommandStatus(
    `Polaris 长任务 QA 完成：trace ${traceSummary.total} 条，audit ${qaSummary.total} 条，warn ${qaSummary.warnCount}，fail ${qaSummary.failCount}。`
  );
}
