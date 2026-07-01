import type { ChatMessage, Conversation } from '../types/domain';
import { extractMemoryRecallAnchors } from './memoryRecallAnchors';
import { isNaturalMemorySourceMessage } from './memoryNaturalSourceMessage';
import { tokenizeMemoryRecallTerms } from './memoryRecallTerms';

export type MemoryRetrievalChunkKind = 'source_message' | 'user_intent' | 'dialogue_turn';

export type MemoryRetrievalSourceRef = {
  conversationId: string;
  messageId: string;
  role: ChatMessage['role'];
  timestamp: number;
};

export type MemoryRetrievalChunk = {
  id: string;
  kind: MemoryRetrievalChunkKind;
  collaboratorId: string | null;
  conversationId: string;
  conversationTitle: string;
  sourceMessageIds: string[];
  sourceRefs: MemoryRetrievalSourceRef[];
  title: string;
  exactText: string;
  semanticText: string;
  keywords: string[];
  createdAt: number;
  updatedAt: number;
};

export type MemoryRetrievalSearchResult = {
  chunk: MemoryRetrievalChunk;
  score: number;
  matchedKeywords: string[];
  matchKind: 'exact_phrase' | 'keyword_overlap';
  authority: 'raw_source';
};

export type MemoryRetrievalConversation = Pick<
  Conversation,
  'id' | 'title' | 'collaboratorId' | 'updatedAt' | 'messages'
>;

export function normalizeMemoryRetrievalText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeMemoryRetrievalQuery(text: string): string[] {
  return tokenizeMemoryRecallTerms(normalizeMemoryRetrievalText(text));
}

function sameCollaboratorScope(params: {
  currentCollaboratorId?: string | null;
  conversationCollaboratorId: string | null;
}) {
  if (!params.currentCollaboratorId) return true;
  return params.conversationCollaboratorId === params.currentCollaboratorId;
}

function stableHash(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function safeTimestamp(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatRoleLabel(role: ChatMessage['role']) {
  return role === 'assistant' ? 'assistant' : 'user';
}

function formatSourceTitle(conversation: MemoryRetrievalConversation, message: ChatMessage) {
  const conversationTitle = conversation.title.trim() || '未命名对话';
  const timestamp = safeTimestamp(message.timestamp, conversation.updatedAt ?? 0);
  const date = timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : 'unknown date';
  return `${conversationTitle} · ${date} · ${formatRoleLabel(message.role)}`;
}

function messageTimestamp(message: ChatMessage, conversation: MemoryRetrievalConversation) {
  return safeTimestamp(message.timestamp, conversation.updatedAt ?? 0);
}

function formatChunkText(messages: ChatMessage[]) {
  if (messages.length === 1) return messages[0]?.content.trim() ?? '';
  return messages
    .map((message) => `${formatRoleLabel(message.role)}: ${message.content.trim()}`)
    .join('\n\n');
}

function buildChunk(params: {
  kind: MemoryRetrievalChunkKind;
  conversation: MemoryRetrievalConversation;
  messages: ChatMessage[];
  title: string;
}): MemoryRetrievalChunk {
  const { conversation, messages } = params;
  const conversationTitle = conversation.title.trim() || '未命名对话';
  const exactText = formatChunkText(messages);
  const semanticText = [conversationTitle, exactText].filter(Boolean).join('\n');
  const timestamps = messages.map((message) => messageTimestamp(message, conversation));
  const createdAt = timestamps.reduce((earliest, timestamp) => Math.min(earliest, timestamp), timestamps[0] ?? 0);
  const updatedAt = timestamps.reduce((latest, timestamp) => Math.max(latest, timestamp), timestamps[0] ?? 0);
  const sourceMessageIds = messages.map((message) => message.id);

  return {
    id: `memory-retrieval:${params.kind}:${conversation.id}:${sourceMessageIds.join('+')}:${stableHash(exactText)}`,
    kind: params.kind,
    collaboratorId: conversation.collaboratorId,
    conversationId: conversation.id,
    conversationTitle,
    sourceMessageIds,
    sourceRefs: messages.map((message) => ({
      conversationId: conversation.id,
      messageId: message.id,
      role: message.role,
      timestamp: messageTimestamp(message, conversation)
    })),
    title: params.title,
    exactText,
    semanticText,
    keywords: tokenizeMemoryRetrievalQuery(`${conversationTitle} ${exactText}`),
    createdAt,
    updatedAt
  };
}

function buildSourceMessageChunk(
  conversation: MemoryRetrievalConversation,
  message: ChatMessage
): MemoryRetrievalChunk {
  return buildChunk({
    kind: 'source_message',
    conversation,
    messages: [message],
    title: formatSourceTitle(conversation, message)
  });
}

function scopedConversations(args: {
  conversations: MemoryRetrievalConversation[];
  activeConversationId?: string | null;
  currentCollaboratorId?: string | null;
}) {
  return args.conversations
    .filter((conversation) => conversation.id !== args.activeConversationId)
    .filter((conversation) => sameCollaboratorScope({
      currentCollaboratorId: args.currentCollaboratorId,
      conversationCollaboratorId: conversation.collaboratorId
    }));
}

export function buildConversationRetrievalChunks(args: {
  conversations: MemoryRetrievalConversation[];
  activeConversationId?: string | null;
  currentCollaboratorId?: string | null;
}): MemoryRetrievalChunk[] {
  return scopedConversations(args)
    .flatMap((conversation) =>
      conversation.messages
        .filter(isNaturalMemorySourceMessage)
        .map((message) => buildSourceMessageChunk(conversation, message))
    )
    .sort((left, right) => {
      const updatedAtDelta = right.updatedAt - left.updatedAt;
      if (updatedAtDelta !== 0) return updatedAtDelta;
      return right.id.localeCompare(left.id);
    });
}

function hasAssistant(messages: ChatMessage[]) {
  return messages.some((message) => message.role === 'assistant');
}

function hasUser(messages: ChatMessage[]) {
  return messages.some((message) => message.role === 'user');
}

function semanticChunkKind(messages: ChatMessage[]): MemoryRetrievalChunkKind {
  return hasAssistant(messages) ? 'dialogue_turn' : 'user_intent';
}

function formatSemanticChunkTitle(conversation: MemoryRetrievalConversation, messages: ChatMessage[]) {
  const conversationTitle = conversation.title.trim() || '未命名对话';
  const latestTimestamp = messages
    .map((message) => messageTimestamp(message, conversation))
    .reduce((latest, timestamp) => Math.max(latest, timestamp), 0);
  const date = latestTimestamp > 0 ? new Date(latestTimestamp).toISOString().slice(0, 10) : 'unknown date';
  const label = semanticChunkKind(messages) === 'dialogue_turn' ? '对话轮' : '用户意图';
  return `${conversationTitle} · ${date} · ${label}`;
}

function groupSemanticMessages(messages: ChatMessage[]) {
  const groups: ChatMessage[][] = [];
  let current: ChatMessage[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
      if (current.length && hasAssistant(current)) {
        groups.push(current);
        current = [];
      }
      current.push(message);
      continue;
    }

    if (hasUser(current)) {
      current.push(message);
    }
  }

  if (current.length && hasUser(current)) {
    groups.push(current);
  }

  return groups;
}

export function buildConversationSemanticChunks(args: {
  conversations: MemoryRetrievalConversation[];
  activeConversationId?: string | null;
  currentCollaboratorId?: string | null;
}): MemoryRetrievalChunk[] {
  return scopedConversations(args)
    .flatMap((conversation) =>
      groupSemanticMessages(conversation.messages.filter(isNaturalMemorySourceMessage))
        .map((messages) => buildChunk({
          kind: semanticChunkKind(messages),
          conversation,
          messages,
          title: formatSemanticChunkTitle(conversation, messages)
        }))
    )
    .sort((left, right) => {
      const updatedAtDelta = right.updatedAt - left.updatedAt;
      if (updatedAtDelta !== 0) return updatedAtDelta;
      return right.id.localeCompare(left.id);
    });
}

function scoreChunk(queryText: string, queryTerms: string[], chunk: MemoryRetrievalChunk) {
  const searchableText = normalizeMemoryRetrievalText([
    chunk.title,
    chunk.exactText,
    chunk.semanticText,
    chunk.keywords.join(' ')
  ].join('\n'));
  const exactPhraseMatch = queryText.length > 0 && searchableText.includes(queryText);
  const matchedKeywords = queryTerms.filter((term) => searchableText.includes(term));
  const queryAnchors = extractMemoryRecallAnchors(queryText);
  const chunkAnchors = new Set(extractMemoryRecallAnchors(searchableText).map((anchor) => anchor.term));
  const matchedAnchors = queryAnchors.filter((anchor) =>
    searchableText.includes(anchor.term) || chunkAnchors.has(anchor.term)
  );

  if (!exactPhraseMatch && !matchedKeywords.length && !matchedAnchors.length) return null;

  const exactPhraseScore = exactPhraseMatch ? 2 : 0;
  const anchorScore = matchedAnchors.reduce((total, anchor) => total + anchor.weight, 0);
  const overlapScore = queryTerms.length
    ? matchedKeywords.length / Math.sqrt(queryTerms.length * Math.max(chunk.keywords.length, 1))
    : 0;
  const recencyScore = chunk.updatedAt > 0 ? Math.log10(chunk.updatedAt + 1) / 100 : 0;

  return {
    score: exactPhraseScore + anchorScore + overlapScore + recencyScore,
    matchedKeywords: Array.from(new Set([
      ...matchedAnchors.map((anchor) => anchor.term),
      ...matchedKeywords
    ])),
    matchKind: exactPhraseMatch ? 'exact_phrase' as const : 'keyword_overlap' as const
  };
}

export function searchMemoryRetrievalChunks(args: {
  query: string;
  chunks: MemoryRetrievalChunk[];
}): MemoryRetrievalSearchResult[] {
  const queryText = normalizeMemoryRetrievalText(args.query);
  const queryTerms = tokenizeMemoryRetrievalQuery(args.query);
  if (!queryText && !queryTerms.length) return [];

  return args.chunks
    .flatMap((chunk) => {
      const scored = scoreChunk(queryText, queryTerms, chunk);
      if (!scored) return [];
      return [{
        chunk,
        score: scored.score,
        matchedKeywords: scored.matchedKeywords,
        matchKind: scored.matchKind,
        authority: 'raw_source' as const
      }];
    })
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) return scoreDelta;
      return right.chunk.updatedAt - left.chunk.updatedAt;
    });
}
