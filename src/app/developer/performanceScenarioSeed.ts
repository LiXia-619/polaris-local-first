import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import { saveAsset } from '../../infrastructure/assetStore';
import { createProjectFileEntry, sortProjectFiles } from '../../stores/collectionStoreProjectFiles';
import { normalizeCodeCard, sortCodeCards } from '../../stores/collectionStoreCodeCards';
import { useChatStore } from '../../stores/chatStore';
import { sortConversations } from '../../stores/chatCurrentPersistence';
import { useCollectionStore } from '../../stores/collectionStore';
import { createRoomProject, sortRoomProjects } from '../../engines/roomProjects';
import { usePersonaStore } from '../../stores/personaStore';
import { useSpaceStore } from '../../stores/spaceStore';
import type { ChatMessage, CodeCard, CollectionShelf, Conversation, ProjectFile, RoomProject } from '../../types/domain';

const PERF_PREFIX = 'perf-';

export type PerformanceScenarioSeedOptions = {
  profile?: 'balanced' | 'aa-heavy';
  collectionShelf?: CollectionShelf;
  collaboratorCount?: number;
  conversationCount?: number;
  messagesPerConversation?: number;
  codeCardCount?: number;
  heavyCollaboratorCardCount?: number;
  lightCollaboratorCardCount?: number;
  attachmentCount?: number;
  projectCount?: number;
  projectFilesPerProject?: number;
};

type ResolvedPerformanceScenarioSeedOptions = Required<Omit<PerformanceScenarioSeedOptions, 'profile' | 'collectionShelf'>> & {
  profile: 'balanced' | 'aa-heavy';
  collectionShelf: CollectionShelf;
};

export type PerformanceScenarioSeedResult = {
  collaboratorCount: number;
  conversationCount: number;
  messageCount: number;
  codeCardCount: number;
  heavyCollaboratorId: string;
  heavyCollaboratorCardCount: number;
  lightCollaboratorId: string;
  lightCollaboratorCardCount: number;
  attachmentCount: number;
  projectCount: number;
  projectFileCount: number;
  activeConversationId: string;
  activeProjectId: string;
  backgroundAssetId: string;
};

function count(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function positiveCount(value: number | undefined, fallback: number) {
  return Math.max(1, count(value, fallback));
}

function isPerfId(value: string | null | undefined) {
  return typeof value === 'string' && value.startsWith(PERF_PREFIX);
}

function timestamp(offset: number) {
  return Date.now() - offset;
}

function resolveProfile(seedOptions: PerformanceScenarioSeedOptions) {
  return seedOptions.profile === 'aa-heavy' ? 'aa-heavy' : 'balanced';
}

function buildLongParagraph(index: number, turn: number) {
  return [
    `这是性能复线对话 ${index + 1} 的第 ${turn + 1} 轮。`,
    '这里故意放长一点，模拟真实长上下文里会出现的连续解释、列表、引用、中文和 emoji 用户✨。',
    '这一段不调用任何 API，只用本地状态把消息、卡片、工作区和皮肤堆起来，方便观察点击延迟、滚动和发热。'
  ].join('');
}

function buildAssistantContent(index: number, turn: number) {
  const body = [
    buildLongParagraph(index, turn),
    '',
    `- 卡片引用：perf-card-${String((index + turn) % 96).padStart(2, '0')}`,
    `- 工作区文件：src/perf-${String(index % 10).padStart(2, '0')}/module-${turn % 8}.ts`,
    '',
    '| 指标 | 状态 |',
    '| --- | --- |',
    `| turn | ${turn + 1} |`,
    `| density | ${turn > 20 ? 'heavy' : 'dense'} |`
  ];

  if (turn % 6 === 2) {
    body.push(
      '',
      '```tsx',
      `export function PerfFixture${index}_${turn}() {`,
      `  return <section data-turn="${turn}">performance fixture ${index}</section>;`,
      '}',
      '```'
    );
  }

  return body.join('\n');
}

function buildMessages(conversationIndex: number, messagesPerConversation: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const turns = Math.max(1, Math.ceil(messagesPerConversation / 2));

  for (let turn = 0; turn < turns; turn += 1) {
    const userId = `perf-msg-${conversationIndex}-${turn}-user`;
    const assistantId = `perf-msg-${conversationIndex}-${turn}-assistant`;
    messages.push({
      id: userId,
      role: 'user',
      origin: 'user-input',
      content: `请继续展开第 ${turn + 1} 段性能复线内容，并保留工作区上下文。`,
      timestamp: timestamp((conversationIndex * 1000 + turn * 12 + 2) * 1000)
    });
    messages.push({
      id: assistantId,
      role: 'assistant',
      origin: 'assistant-reply',
      assistantName: `Perf 协作者 ${(conversationIndex % 10) + 1}`,
      content: buildAssistantContent(conversationIndex, turn),
      timestamp: timestamp((conversationIndex * 1000 + turn * 12 + 1) * 1000)
    });

    if (turn % 8 === 3) {
      messages.push({
        id: `perf-msg-${conversationIndex}-${turn}-tool`,
        role: 'system',
        origin: 'tool-runtime',
        content: '已写入性能复线工作区文件。',
        timestamp: timestamp((conversationIndex * 1000 + turn * 12) * 1000),
        toolInvocation: {
          id: `perf-tool-${conversationIndex}-${turn}`,
          kind: 'writeProjectFiles',
          status: 'executed',
          title: '写入工作区文件',
          summary: '性能复线生成的本地工具事件。',
          originMessageId: assistantId,
          projectFilePaths: [`src/perf-${String(conversationIndex % 10).padStart(2, '0')}/module-${turn % 8}.ts`]
        }
      });
    }
  }

  return messages;
}

function buildAttachmentMessage(attachmentIndex: number): ChatMessage {
  const textContent = [
    `# 性能复线附件 ${attachmentIndex + 1}`,
    '',
    buildLongParagraph(attachmentIndex, attachmentIndex % 10),
    '',
    '- 只保留形状，不保留真实内容。',
    '- 用来模拟大量复制记录、草稿和随手存档附件。'
  ].join('\n');

  return {
    id: `perf-attachment-msg-${String(attachmentIndex).padStart(3, '0')}`,
    role: 'user',
    origin: 'user-input',
    content: `保存附件形状 ${attachmentIndex + 1}`,
    timestamp: timestamp((attachmentIndex + 1) * 22_000),
    attachments: [{
      id: `perf-attachment-${String(attachmentIndex).padStart(3, '0')}`,
      assetId: `perf-attachment-asset-${String(attachmentIndex).padStart(3, '0')}`,
      kind: 'file',
      name: `perf-note-${String(attachmentIndex + 1).padStart(2, '0')}.md`,
      mimeType: 'text/markdown',
      size: textContent.length,
      textContent
    }]
  };
}

function buildConversations(options: ResolvedPerformanceScenarioSeedOptions, activeProjectId: string) {
  const conversations: Conversation[] = [];
  for (let index = 0; index < options.conversationCount; index += 1) {
    const collaboratorId =
      options.profile === 'aa-heavy' && index < Math.ceil(options.conversationCount * 0.58)
        ? 'perf-persona-00'
        : `perf-persona-${String(index % options.collaboratorCount).padStart(2, '0')}`;
    const projectId = index % 5 === 0 ? activeProjectId : index % 3 === 0 ? `perf-project-${String(index % options.projectCount).padStart(2, '0')}` : null;
    const messages = buildMessages(index, options.messagesPerConversation);
    if (collaboratorId === 'perf-persona-00') {
      const attachmentOffset = conversations.filter((conversation) => conversation.collaboratorId === 'perf-persona-00').length;
      if (attachmentOffset < options.attachmentCount) {
        messages.splice(1, 0, buildAttachmentMessage(attachmentOffset));
      }
    }
    conversations.push({
      id: `perf-conv-${String(index).padStart(3, '0')}`,
      title: `性能复线长对话 ${String(index + 1).padStart(2, '0')}`,
      collaboratorId,
      activeProjectId: projectId,
      messages,
      pinnedAt: index < 4 ? timestamp(index * 1000) : null,
      updatedAt: timestamp(index * 60_000),
      draft: '',
      toolLedger: undefined
    });
  }
  return conversations;
}

function buildCodeCardCss(index: number) {
  const mark = index % 3 === 0 ? 'DIARY\\A0504' : index % 3 === 1 ? 'COPY\\A LOG' : 'ROOM\\A NOTE';
  return [
    '& {',
    '  position: relative;',
    '  overflow: hidden;',
    '  background: linear-gradient(135deg, rgba(255,255,255,.82), rgba(210,224,255,.42));',
    '  box-shadow: 0 18px 42px rgba(80, 97, 142, .14);',
    '  backdrop-filter: blur(18px) saturate(1.08);',
    '  border: 1.5px solid rgba(120, 148, 210, .22);',
    '}',
    '',
    '&::before {',
    `  content: "${mark}";`,
    '  white-space: pre;',
    '  position: absolute;',
    '  right: -8px;',
    '  top: 14px;',
    '  transform: rotate(7deg);',
    '  font-family: Georgia, serif;',
    '  font-size: 16px;',
    '  letter-spacing: .08em;',
    '  color: rgba(82, 102, 148, .20);',
    '}',
    '',
    '& h3 {',
    '  color: rgba(31, 42, 68, .96);',
    '}',
    '',
    '& .code-card-snippet {',
    '  color: rgba(65, 82, 118, .72);',
    '}'
  ].join('\n');
}

function resolveCardOwner(index: number, options: ResolvedPerformanceScenarioSeedOptions) {
  if (options.profile === 'balanced') {
    return `perf-persona-${String(index % options.collaboratorCount).padStart(2, '0')}`;
  }
  if (index < options.heavyCollaboratorCardCount) return 'perf-persona-00';
  if (options.collaboratorCount > 1 && index < options.heavyCollaboratorCardCount + options.lightCollaboratorCardCount) {
    return 'perf-persona-01';
  }
  const firstTailCollaborator = options.collaboratorCount > 2 ? 2 : 0;
  const tailCollaboratorCount = options.collaboratorCount > 2 ? options.collaboratorCount - 2 : options.collaboratorCount;
  return `perf-persona-${String(firstTailCollaborator + (index % tailCollaboratorCount)).padStart(2, '0')}`;
}

function buildCodeCards(options: ResolvedPerformanceScenarioSeedOptions): CodeCard[] {
  return sortCodeCards(Array.from({ length: options.codeCardCount }, (_, index) =>
    normalizeCodeCard({
      id: `perf-card-${String(index).padStart(2, '0')}`,
      title: `性能复线卡片 ${String(index + 1).padStart(2, '0')}`,
      cardNote: '本地生成的高压代码卡。',
      language: index % 3 === 0 ? 'html' : index % 3 === 1 ? 'css' : 'tsx',
      code: `<section class="perf-card"><h1>Perf Card ${index + 1}</h1><p>${buildLongParagraph(index, index % 12)}</p></section>`,
      cardFaceCss: buildCodeCardCss(index),
      tags: ['performance', index % 2 === 0 ? 'dense' : 'workspace'],
      ownerCollaboratorId: resolveCardOwner(index, options),
      source: 'chat-generated',
      createdAt: timestamp(index * 40_000),
      updatedAt: timestamp(index * 35_000),
      originConversationId: `perf-conv-${String(index % options.conversationCount).padStart(3, '0')}`,
      originMessageId: `perf-msg-${index % options.conversationCount}-${index % Math.ceil(options.messagesPerConversation / 2)}-assistant`,
      originBlockIndex: index % 3,
      originBlockTitle: `Perf block ${index + 1}`
    })
  ));
}

function buildProjectFileContent(projectIndex: number, fileIndex: number) {
  if (fileIndex === 0) {
    return `<main class="perf-project"><h1>Perf Project ${projectIndex + 1}</h1><button>交互按钮</button><p>${buildLongParagraph(projectIndex, fileIndex)}</p></main>`;
  }
  if (fileIndex === 1) {
    return '.perf-project { min-height: 100vh; display: grid; place-items: center; backdrop-filter: blur(18px); }';
  }
  return [
    `export const perfModule${projectIndex}_${fileIndex} = {`,
    `  id: "perf-project-${projectIndex}-${fileIndex}",`,
    `  copy: ${JSON.stringify(buildLongParagraph(projectIndex, fileIndex))}`,
    '};'
  ].join('\n');
}

function buildProjects(options: ResolvedPerformanceScenarioSeedOptions) {
  const projects: RoomProject[] = [];
  const files: ProjectFile[] = [];

  for (let projectIndex = 0; projectIndex < options.projectCount; projectIndex += 1) {
    const projectId = `perf-project-${String(projectIndex).padStart(2, '0')}`;
    const fileIds = Array.from({ length: options.projectFilesPerProject }, (_, fileIndex) =>
      `perf-file-${String(projectIndex).padStart(2, '0')}-${String(fileIndex).padStart(2, '0')}`
    );
    projects.push(createRoomProject({
      id: projectId,
      title: `性能复线工作区 ${String(projectIndex + 1).padStart(2, '0')}`,
      ownerCollaboratorId: `perf-persona-${String(projectIndex % options.collaboratorCount).padStart(2, '0')}`,
      entryFileId: fileIds[0],
      fileIds,
      tags: ['performance', 'workspace'],
      coverNote: '本地高压工作区，用来复线项目文件列表和聊天绑定。',
      source: 'chat-generated',
      createdAt: timestamp(projectIndex * 90_000),
      updatedAt: timestamp(projectIndex * 70_000)
    }));

    fileIds.forEach((fileId, fileIndex) => {
      const filePath = fileIndex === 0
        ? 'index.html'
        : fileIndex === 1
          ? 'styles/perf.css'
          : `src/modules/module-${fileIndex}.ts`;
      files.push(createProjectFileEntry({
        id: fileId,
        projectId,
        filePath,
        fileRole: fileIndex === 0 ? 'entry' : fileIndex === 1 ? 'style' : 'logic',
        language: fileIndex === 0 ? 'html' : fileIndex === 1 ? 'css' : 'typescript',
        content: buildProjectFileContent(projectIndex, fileIndex),
        ownerCollaboratorId: `perf-persona-${String(projectIndex % options.collaboratorCount).padStart(2, '0')}`,
        source: 'chat-generated',
        createdAt: timestamp(projectIndex * 90_000 + fileIndex * 8000),
        updatedAt: timestamp(projectIndex * 70_000 + fileIndex * 5000)
      }));
    });
  }

  return {
    projects: sortRoomProjects(projects),
    files: sortProjectFiles(files)
  };
}

function buildPersonas(options: Required<PerformanceScenarioSeedOptions>) {
  return Array.from({ length: options.collaboratorCount }, (_, index) =>
    createPersonaTemplate({
      id: `perf-persona-${String(index).padStart(2, '0')}`,
      name: `Perf 协作者 ${index + 1}`,
      description: '本地性能复线协作者',
      purpose: '制造可重复的长对话、卡片和工作区压力，不调用任何外部 API。',
      baseId: 'executor',
      relationship: 'partner',
      expression: 'natural',
      builderManaged: false,
      compiledPrompt: ''
    })
  );
}

function buildStressSkinCss() {
  return `
.app-shell .conversation-card {
  --collection-dialogue-card-backdrop: blur(20px) saturate(1.12);
  --collection-dialogue-card-shadow: 0 18px 44px rgba(77, 88, 124, .18);
}
.app-shell.chat .bubble.user,
.app-shell.chat .tool-event,
.app-shell.chat .thinking-box,
.app-shell.chat .message-code-card,
.app-shell.chat .message-code-drawer-head,
.app-shell.chat .active-preview-strip,
.app-shell.chat .chat-box {
  backdrop-filter: blur(18px) saturate(1.12);
  box-shadow: 0 18px 38px rgba(75, 88, 130, .14);
}
`.trim();
}

function buildBackgroundSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f8fbff"/>
      <stop offset="0.42" stop-color="#d9e5ff"/>
      <stop offset="1" stop-color="#f7dbe6"/>
    </linearGradient>
    <radialGradient id="glowA" cx="25%" cy="16%" r="52%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".88"/>
      <stop offset=".58" stop-color="#b9cdfd" stop-opacity=".28"/>
      <stop offset="1" stop-color="#b9cdfd" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="78%" cy="72%" r="50%">
      <stop offset="0" stop-color="#ffe3ee" stop-opacity=".82"/>
      <stop offset=".62" stop-color="#efbdd3" stop-opacity=".24"/>
      <stop offset="1" stop-color="#efbdd3" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1800" fill="url(#sky)"/>
  <rect width="1200" height="1800" fill="url(#glowA)"/>
  <rect width="1200" height="1800" fill="url(#glowB)"/>
  <path d="M0 1220 C260 1140 380 1310 610 1240 C820 1176 948 1050 1200 1128 L1200 1800 L0 1800 Z" fill="#fff7fb" opacity=".54"/>
  <path d="M0 1410 C230 1340 390 1510 670 1422 C890 1354 1010 1260 1200 1328 L1200 1800 L0 1800 Z" fill="#edf3ff" opacity=".62"/>
</svg>
`.trim();
}

async function savePerformanceBackgroundAsset() {
  const blob = new Blob([buildBackgroundSvg()], { type: 'image/svg+xml' });
  return saveAsset({
    id: `${PERF_PREFIX}background-asset`,
    kind: 'image',
    name: 'performance-background.svg',
    mimeType: 'image/svg+xml',
    blob,
    previewBlob: blob
  });
}

export async function seedPerformanceScenario(
  seedOptions: PerformanceScenarioSeedOptions = {}
): Promise<PerformanceScenarioSeedResult> {
  const profile = resolveProfile(seedOptions);
  const codeCardCount = count(seedOptions.codeCardCount, profile === 'aa-heavy' ? 180 : 96);
  const defaultHeavyCardCount = profile === 'aa-heavy' ? Math.min(codeCardCount, 132) : 0;
  const defaultLightCardCount = profile === 'aa-heavy' ? Math.min(Math.max(0, codeCardCount - defaultHeavyCardCount), 12) : 0;
  const options: ResolvedPerformanceScenarioSeedOptions = {
    profile,
    collectionShelf: seedOptions.collectionShelf ?? 'dialogue',
    collaboratorCount: positiveCount(seedOptions.collaboratorCount, profile === 'aa-heavy' ? 8 : 10),
    conversationCount: positiveCount(seedOptions.conversationCount, profile === 'aa-heavy' ? 120 : 72),
    messagesPerConversation: positiveCount(seedOptions.messagesPerConversation, profile === 'aa-heavy' ? 84 : 56),
    codeCardCount,
    heavyCollaboratorCardCount: Math.min(codeCardCount, count(seedOptions.heavyCollaboratorCardCount, defaultHeavyCardCount)),
    lightCollaboratorCardCount: Math.min(
      Math.max(0, codeCardCount - Math.min(codeCardCount, count(seedOptions.heavyCollaboratorCardCount, defaultHeavyCardCount))),
      count(seedOptions.lightCollaboratorCardCount, defaultLightCardCount)
    ),
    attachmentCount: count(seedOptions.attachmentCount, profile === 'aa-heavy' ? 36 : 0),
    projectCount: positiveCount(seedOptions.projectCount, profile === 'aa-heavy' ? 12 : 10),
    projectFilesPerProject: positiveCount(seedOptions.projectFilesPerProject, profile === 'aa-heavy' ? 10 : 8)
  };
  const activeProjectId = 'perf-project-00';
  const activeConversationId = 'perf-conv-000';
  const personas = buildPersonas(options);
  const conversations = buildConversations(options, activeProjectId);
  const cards = buildCodeCards(options);
  const { projects, files } = buildProjects(options);
  const backgroundAsset = await savePerformanceBackgroundAsset();

  usePersonaStore.setState((state) => ({
    personas: [...personas, ...state.personas.filter((persona) => !isPerfId(persona.id))],
    activeCollaboratorId: personas[0]?.id ?? state.activeCollaboratorId,
    hydrated: true
  }));

  useChatStore.setState((state) => ({
    conversations: sortConversations([
      ...conversations,
      ...state.conversations.filter((conversation) => !isPerfId(conversation.id))
    ]),
    activeConversationId,
    inputDraft: '',
    pendingWorkspaceProposals: state.pendingWorkspaceProposals.filter((proposal) => !isPerfId(proposal.id)),
    dirtyConversationIds: Array.from(new Set([...state.dirtyConversationIds, ...conversations.map((conversation) => conversation.id)])),
    conversationPersistVersion: state.conversationPersistVersion + 1,
    hydrated: true
  }));

  useCollectionStore.setState((state) => ({
    cards: sortCodeCards([
      ...cards,
      ...state.cards.filter((card) => !isPerfId(card.id))
    ]),
    projectFiles: sortProjectFiles([
      ...files,
      ...state.projectFiles.filter((file) => !isPerfId(file.id))
    ]),
    roomProjects: sortRoomProjects([
      ...projects,
      ...state.roomProjects.filter((project) => !isPerfId(project.id))
    ]),
    imageCards: state.imageCards.filter((card) => !isPerfId(card.id)),
    hydrated: true
  }));

  const spaceState = useSpaceStore.getState();
  spaceState.setWorld('collection');
  spaceState.setCollectionShelf(options.collectionShelf);
  spaceState.setFrontstageCollaboratorId(null);
  spaceState.setCollectionProjectId(activeProjectId);
  spaceState.setActiveCard(cards[0]?.id ?? null);
  spaceState.clearPendingAttachments();
  spaceState.clearPendingCardReference();
  spaceState.setCustomization({
    showChatAvatars: true,
    backgroundAssetId: backgroundAsset.id,
    backgroundBlur: 22,
    backgroundOpacity: 0.72,
    backgroundDim: 0.42
  });
  spaceState.setCustomCSS(buildStressSkinCss());

  await Promise.all([
    useChatStore.getState().persistToDb(),
    usePersonaStore.getState().persistToDb(),
    useCollectionStore.getState().persistToDb()
  ]);

  return {
    collaboratorCount: personas.length,
    conversationCount: conversations.length,
    messageCount: conversations.reduce((total, conversation) => total + conversation.messages.length, 0),
    codeCardCount: cards.length,
    heavyCollaboratorId: 'perf-persona-00',
    heavyCollaboratorCardCount: cards.filter((card) => card.ownerCollaboratorId === 'perf-persona-00').length,
    lightCollaboratorId: 'perf-persona-01',
    lightCollaboratorCardCount: cards.filter((card) => card.ownerCollaboratorId === 'perf-persona-01').length,
    attachmentCount: conversations.reduce((total, conversation) => (
      total + conversation.messages.reduce((messageTotal, message) => messageTotal + (message.attachments?.length ?? 0), 0)
    ), 0),
    projectCount: projects.length,
    projectFileCount: files.length,
    activeConversationId,
    activeProjectId,
    backgroundAssetId: backgroundAsset.id
  };
}
