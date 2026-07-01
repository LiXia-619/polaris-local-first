import { createMessage } from '../../engines/chatMessageFactory';
import type { ChatDerivedStatePort } from '../chat/chatPorts';
import type { ChatReplyRequestSnapshotSource } from '../chat/chatReplyContext';
import type { ChatMessage, Conversation, Persona } from '../../types/domain';
import { condenseFencedCode } from './groupMessageCode';
import { oneLine } from './groupText';

export const GROUP_SILENCE_SENTINEL = '[沉默]';

export const GROUP_LANE_TOOL_SETTINGS: NonNullable<Conversation['group']>['toolSettings'] = {
  cards: false,
  images: false,
  attachments: false,
  web: false,
  mcp: false
};

export function groupMemoryRecallEnabled(conversation: Conversation | null | undefined) {
  return conversation?.group?.memoryRecallEnabled !== false;
}

export function buildGroupToolPreferences(
  source: ChatReplyRequestSnapshotSource['enabledToolGroups'],
  toolSettings: NonNullable<Conversation['group']>['toolSettings'],
  options: {
    memoryRecallEnabled?: boolean;
  } = {}
) {
  const memoryContextEnabled = options.memoryRecallEnabled !== false;
  return {
    task: false,
    project: false,
    desktop: false,
    theme: false,
    archive: false,
    knowledge: false,
    proactive: false,
    room: toolSettings.cards === true,
    generation: toolSettings.images === true && source.generation !== false,
    attachment: toolSettings.attachments === true,
    web: toolSettings.web === true && source.web !== false,
    mcp: toolSettings.mcp === true && source.mcp !== false,
    memory: memoryContextEnabled && source.memory !== false,
    memoryRecall: memoryContextEnabled && source.memoryRecall !== false,
    memoryWrite: source.memoryWrite === true
  };
}

export function buildGroupMemberSystemMessage(args: {
  conversation: Conversation;
  member: Persona;
  members: Persona[];
}): ChatMessage {
  const title = args.conversation.group?.title ?? args.conversation.title;
  const rosterLines = args.members
    .map((member) => {
      const intro = oneLine(member.description || member.purpose || '');
      return intro ? `- ${member.name} —— ${intro}` : `- ${member.name}`;
    })
    .join('\n');
  const allowSilence = args.conversation.group?.allowMemberSilence === true;
  const replyMode = args.conversation.group?.replyMode ?? 'round';
  const lines = [
    `这里是群聊「${title}」，一个多人公开房间。群成员：`,
    rosterLines,
    `现在轮到你发言。你是 ${args.member.name}，只以自己的身份说话，不替任何人发言，也不写旁白。`,
    '这是群聊上下文，不是用户突然回到和你的单独私聊；即使群里只有用户在说话，你也是在一个多人房间里发言。',
    '历史消息里，以【名字】开头的是其他成员说的话；没有标记的 user 消息来自用户本人；你自己说过的话不带标记。',
    '你不是在回答一条广播，而是在群聊里接上一位的话。先看最近几条公开消息：如果上一位成员刚说了和你有关的内容，先接住他；如果用户刚点名你，优先回应用户点你的事。',
    '不是每条消息都需要所有成员发言。你只在自己确实能推进对话时说；如果更适合别人接，就自然地 @ 那个人，把话递出去。',
    replyMode === 'random'
      ? '这个群现在是随机节奏：其他成员可能几乎同时或稍后开口。你只需要像真实群聊里自然插话一样说自己的这一句。'
      : '这个群现在是轮次节奏：这一轮里成员会轮到发言；如果用户中途插话，还没说的人会基于最新消息继续接。',
    '像人在群里发消息那样说话：直接、自然，长度合适。你的思考过程、工具调用和失败重试别人都看不到，公开消息只放结果和值得全群看到的内容。',
    '如果你说的事特别需要某位成员回应或接着做，就在消息里自然地写出 @他的名字，他会接到发言机会；不需要谁接话就不要 @。被 @ 到时优先回应 @ 你的那件事。'
  ];
  if (args.conversation.group?.toolSettings?.mcp === true) {
    lines.push('这个群接了外部工具（MCP），调用可能产生真实副作用。群里上文提到某件事已经做过的，不要再执行一遍；拿不准就先在群里问一句。');
  }
  if (allowSilence) {
    lines.push(`如果这一轮你确实没有想说的话，只回复 ${GROUP_SILENCE_SENTINEL}，这条会被收走，不会出现在群里。`);
  }
  return {
    id: `group-context-${args.conversation.id}-${args.member.id}`,
    role: 'system',
    content: lines.join('\n'),
    timestamp: Date.now(),
    origin: 'system-note',
    requestRole: 'system'
  };
}

/**
 * 贴身身份锚：放在请求最末、紧贴模型开口的位置。
 * 人格的 compiledPrompt 往往把一切都框成"和用户的专属私聊"，那篇长 prompt 在最前面、
 * 离生成点最远；靠近因效应，这条最后出现的提醒才压得住"用户回到我私聊了"的滑坡。
 */
export function buildGroupTurnAnchorMessage(args: {
  conversation: Conversation;
  member: Persona;
}): ChatMessage {
  const title = args.conversation.group?.title ?? args.conversation.title;
  return {
    id: `group-turn-${args.conversation.id}-${args.member.id}`,
    role: 'system',
    content: [
      `（上面是群聊「${title}」的公开时间线，不是用户回到了和你的单独私聊。）`,
      `现在轮到你（${args.member.name}）说一句：只代表自己，不替别人发言、不写旁白，像在多人房间里自然接话那样。`
    ].join('\n'),
    timestamp: Date.now(),
    origin: 'system-note',
    requestRole: 'system'
  };
}

const LANE_DIGEST_ENTRY_LIMIT = 12;

export function laneWhisperEntries(conversation: Conversation | null, memberId: string) {
  const entries = conversation?.group?.privateLanes?.[memberId] ?? [];
  return entries.filter((entry) => entry.kind === 'user-note' || entry.kind === 'assistant-note');
}

export function buildLaneDigestMessage(args: {
  conversation: Conversation;
  member: Persona;
}): ChatMessage | null {
  const entries = laneWhisperEntries(args.conversation, args.member.id).slice(-LANE_DIGEST_ENTRY_LIMIT);
  if (entries.length === 0) return null;
  const title = args.conversation.group?.title ?? args.conversation.title;
  // 「新」的基准：你上次在群里开口之后才说的悄悄话，多半就是冲着这一轮来的
  const lastSpokeAt = [...args.conversation.messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.speakerCollaboratorId === args.member.id)
    ?.timestamp ?? 0;
  const hasFresh = entries.some((entry) => entry.createdAt > lastSpokeAt);
  const lines = entries.map((entry) =>
    `${entry.createdAt > lastSpokeAt ? '〔新〕' : ''}${entry.author === 'user' ? '用户' : '你'}：${entry.content}`
  );
  return {
    id: `group-lane-digest-${args.conversation.id}-${args.member.id}`,
    role: 'system',
    content: [
      `用户在群聊「${title}」现场单独拉着你（${args.member.name}）开了一个一对一小窗。下面是小窗内容，按时间从旧到新——这不是旧对话摘要，是正在进行的、只说给你一个人的话：`,
      ...lines,
      hasFresh
        ? '标〔新〕的是你上次在群里发言之后用户才说的，大概率和这一轮直接相关，回应群聊时记得它们的存在。'
        : '这些都是你上次在群里发言之前聊过的，当作你们之间已有的默契。',
      '小窗内容群里其他成员不会自动看到。要不要带进群里说，按内容和场合自己判断：贴近私事的就收在心里，群里正需要同步的信息可以自然转述，不用逐字复述。'
    ].join('\n'),
    timestamp: Date.now(),
    origin: 'system-note',
    requestRole: 'system'
  };
}

export function buildWhisperSystemMessage(args: {
  conversation: Conversation;
  member: Persona;
  members: Persona[];
}): ChatMessage {
  const title = args.conversation.group?.title ?? args.conversation.title;
  const others = args.members
    .filter((member) => member.id !== args.member.id)
    .map((member) => member.name)
    .join('、');
  return {
    id: `group-lane-context-${args.conversation.id}-${args.member.id}`,
    role: 'system',
    content: [
      `这里是群聊「${title}」现场、用户单独拉着你（${args.member.name}）开的一对一小窗：用户此刻就是在和你说话，不是历史记录。${others ? `${others}等` : ''}群里其他成员不会自动看到这里的内容。`,
      '历史消息里以【名字】开头的是群里其他成员说过的公开消息，没有标记的 user 消息有的来自群里、有的来自这个窗口，按时间排在一起；你自己的消息不带标记。',
      '在这里自然地、面对面地回应。回到群里发言时你记得这里聊过的一切；要不要在群里提，按内容和场合自己判断——贴近私事的就收在心里，群里正需要的信息可以自然转述。'
    ].join('\n'),
    timestamp: Date.now(),
    origin: 'system-note',
    requestRole: 'system'
  };
}

export function labelRequestMessagesForMember(args: {
  messages: ChatMessage[];
  member: Persona;
  members: Persona[];
}): ChatMessage[] {
  const nameById = new Map(args.members.map((member) => [member.id, member.name]));
  const labeled: ChatMessage[] = [];
  for (const message of args.messages) {
    if (message.role !== 'assistant') {
      labeled.push(message);
      continue;
    }
    const speakerId = message.speakerCollaboratorId ?? null;
    if (speakerId === args.member.id) {
      labeled.push(message);
      continue;
    }
    if (!message.content.trim()) continue;
    const speakerName = (speakerId ? nameById.get(speakerId) : null) ?? message.assistantName ?? '协作者';
    labeled.push({
      ...message,
      requestRole: 'user',
      requestContent: `【${speakerName}】${condenseFencedCode(message.content)}`
    });
  }
  return labeled;
}

export function buildGroupDerived(conversation: Conversation | null, member: Persona | null): ChatDerivedStatePort {
  return {
    activeConversation: conversation
      ? {
          id: conversation.id,
          title: conversation.title,
          collaboratorId: member?.id ?? null,
          activeProjectId: null,
          messages: conversation.messages
        }
      : null,
    activeCollaboratorSourceId: member?.id ?? null,
    persona: member,
    hasUnsupportedPendingImages: false,
    codeCardActionModeByMessageId: {}
  };
}
