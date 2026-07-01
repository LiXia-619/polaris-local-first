import type { AssistantRequestContext } from './request/requestContext';
import type { MemoryRetrievalChunk, MemoryRetrievalSourceRef } from './memoryRetrievalIndex';

export type MemorySemanticPreparationInputChunk = Pick<
  MemoryRetrievalChunk,
  | 'id'
  | 'kind'
  | 'collaboratorId'
  | 'conversationId'
  | 'conversationTitle'
  | 'sourceMessageIds'
  | 'sourceRefs'
  | 'title'
  | 'exactText'
  | 'semanticText'
  | 'keywords'
  | 'createdAt'
  | 'updatedAt'
>;

export type RawMemorySemanticPreparation = {
  chunkId?: unknown;
  title?: unknown;
  keywords?: unknown;
  summary?: unknown;
  semanticText?: unknown;
};

export type MemorySemanticPreparedChunk = {
  id: string;
  sourceChunkId: string;
  kind: MemoryRetrievalChunk['kind'];
  collaboratorId: string | null;
  conversationId: string;
  conversationTitle: string;
  sourceMessageIds: string[];
  sourceRefs: MemoryRetrievalSourceRef[];
  title: string;
  keywords: string[];
  summary: string;
  semanticText: string;
  sourceCharCount: number;
  generator: 'small_model' | 'raw_source';
  generatedAt: number;
  createdAt: number;
  updatedAt: number;
};

type RawMemorySemanticPreparationOutput = {
  chunks?: unknown;
};

const MEMORY_SEMANTIC_PREPARATION_SYSTEM_PROMPT = [
  '你是 Polaris 的语义索引整理小模型。',
  '你的任务是把已经由本地系统切好的旧对话片段整理成检索材料。',
  '不要新增事实，不要猜来源，不要把片段写成已确认记忆。',
  'chunkId 必须照抄输入里的 chunkId；不要输出 conversationId 或 messageId。',
  'summary 是给主模型快速判断相关性的摘要；semanticText 是给 embedding 模型使用的语义文本。',
  'semanticText 应该保留用户表达、主题、对象、关键限制和助手承接方式，但不要逐字复读整段原文。',
  '只输出 JSON，不输出 Markdown，不输出解释。'
].join('\n');

function extractJsonObjectText(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) {
    const candidate = fencedJson[1].trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function formatPreparationSource(chunk: MemorySemanticPreparationInputChunk) {
  return [
    `chunkId: ${chunk.id}`,
    `kind: ${chunk.kind}`,
    `localTitle: ${chunk.title}`,
    `conversationTitle: ${chunk.conversationTitle}`,
    '',
    'sourceText:',
    chunk.exactText
  ].join('\n');
}

function buildMemorySemanticPreparationUserPrompt(chunks: MemorySemanticPreparationInputChunk[]) {
  return [
    '输出格式必须是这个 JSON 对象：',
    '{"chunks":[{"chunkId":"照抄输入 chunkId","title":"短标题","keywords":["关键词"],"summary":"简短摘要","semanticText":"给 embedding 的语义文本"}]}',
    '',
    '整理规则：',
    '- 不要新增输入片段里没有的信息。',
    '- 不要把 summary 写成 confirmed memory。',
    '- keywords 只放片段内真实出现或直接指向的主题词。',
    '- semanticText 可以比 summary 更完整，但仍然只服务检索。',
    '',
    '待整理片段：',
    chunks.map(formatPreparationSource).join('\n\n---\n\n')
  ].join('\n');
}

export function buildMemorySemanticPreparationRequestContext(
  chunks: MemorySemanticPreparationInputChunk[]
): AssistantRequestContext {
  return {
    memorySlots: {
      session: [],
      profile: [],
      pin: []
    },
    attachmentSlots: {
      enabled: false,
      pending: []
    },
    segments: [
      {
        kind: 'system',
        messages: [{
          role: 'system',
          content: MEMORY_SEMANTIC_PREPARATION_SYSTEM_PROMPT
        }]
      },
      {
        kind: 'conversation',
        messages: [{
          role: 'user',
          content: buildMemorySemanticPreparationUserPrompt(chunks)
        }]
      }
    ],
    toolChoice: 'none'
  };
}

export function parseMemorySemanticPreparationModelOutput(text: string): RawMemorySemanticPreparation[] {
  const parsed = JSON.parse(extractJsonObjectText(text)) as RawMemorySemanticPreparationOutput;
  return Array.isArray(parsed.chunks)
    ? parsed.chunks.filter((item): item is RawMemorySemanticPreparation => (
        typeof item === 'object' && item !== null
      ))
    : [];
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKeywords(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const keywords = value
    .map((item) => normalizeString(item))
    .filter(Boolean);
  return keywords.length ? Array.from(new Set(keywords)) : fallback;
}

export function normalizeMemorySemanticPreparations(args: {
  rawPreparations: RawMemorySemanticPreparation[];
  chunks: MemorySemanticPreparationInputChunk[];
  now: number;
}): MemorySemanticPreparedChunk[] {
  const chunksById = new Map(args.chunks.map((chunk) => [chunk.id, chunk]));

  return args.rawPreparations.flatMap((raw) => {
    const chunkId = normalizeString(raw.chunkId);
    const chunk = chunksById.get(chunkId);
    if (!chunk) return [];

    const summary = normalizeString(raw.summary);
    const semanticText = normalizeString(raw.semanticText) || summary || chunk.semanticText;

    return [{
      id: `memory-semantic-preparation:${chunk.id}`,
      sourceChunkId: chunk.id,
      kind: chunk.kind,
      collaboratorId: chunk.collaboratorId,
      conversationId: chunk.conversationId,
      conversationTitle: chunk.conversationTitle,
      sourceMessageIds: chunk.sourceMessageIds,
      sourceRefs: chunk.sourceRefs,
      title: normalizeString(raw.title) || chunk.title,
      keywords: normalizeKeywords(raw.keywords, chunk.keywords),
      summary: summary || semanticText,
      semanticText,
      sourceCharCount: chunk.exactText.length,
      generator: 'small_model',
      generatedAt: args.now,
      createdAt: chunk.createdAt,
      updatedAt: chunk.updatedAt
    }];
  });
}

export function prepareRawMemorySemanticChunks(args: {
  chunks: MemorySemanticPreparationInputChunk[];
  now: number;
}): MemorySemanticPreparedChunk[] {
  return args.chunks.map((chunk) => ({
    id: `memory-semantic-preparation:${chunk.id}`,
    sourceChunkId: chunk.id,
    kind: chunk.kind,
    collaboratorId: chunk.collaboratorId,
    conversationId: chunk.conversationId,
    conversationTitle: chunk.conversationTitle,
    sourceMessageIds: chunk.sourceMessageIds,
    sourceRefs: chunk.sourceRefs,
    title: chunk.title,
    keywords: chunk.keywords,
    summary: chunk.semanticText,
    semanticText: chunk.semanticText,
    sourceCharCount: chunk.exactText.length,
    generator: 'raw_source',
    generatedAt: args.now,
    createdAt: chunk.createdAt,
    updatedAt: chunk.updatedAt
  }));
}
