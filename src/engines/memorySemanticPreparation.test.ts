import { describe, expect, it } from 'vitest';
import {
  buildMemorySemanticPreparationRequestContext,
  normalizeMemorySemanticPreparations,
  prepareRawMemorySemanticChunks,
  parseMemorySemanticPreparationModelOutput
} from './memorySemanticPreparation';
import { buildConversationSemanticChunks } from './memoryRetrievalIndex';
import type { ChatMessage, Conversation } from '../types/domain';

function message(seed: Partial<ChatMessage> & {
  id: string;
  role?: ChatMessage['role'];
  content: string;
  timestamp: number;
}): ChatMessage {
  return {
    id: seed.id,
    role: seed.role ?? 'user',
    content: seed.content,
    timestamp: seed.timestamp
  };
}

function conversation(seed: {
  id: string;
  title: string;
  collaboratorId?: string | null;
  messages: ChatMessage[];
  updatedAt?: number;
}): Conversation {
  return {
    id: seed.id,
    title: seed.title,
    collaboratorId: seed.collaboratorId ?? 'pharos',
    messages: seed.messages,
    pinnedAt: null,
    updatedAt: seed.updatedAt ?? 1
  };
}

function semanticChunk() {
  return buildConversationSemanticChunks({
    currentCollaboratorId: 'pharos',
    conversations: [
      conversation({
        id: 'old',
        title: '向量索引讨论',
        messages: [
          message({ id: 'u1', content: '跨对话和向量要并列设置。', timestamp: 1 }),
          message({ id: 'u2', content: '关掉跨对话后不要保留向量索引。', timestamp: 2 }),
          message({
            id: 'a1',
            role: 'assistant',
            content: '向量索引只在跨对话开启时存在，关闭时清理状态。',
            timestamp: 3
          })
        ]
      })
    ]
  })[0];
}

describe('buildMemorySemanticPreparationRequestContext', () => {
  it('builds a no-tool organizer request from locally stamped chunks', () => {
    const chunk = semanticChunk();
    const context = buildMemorySemanticPreparationRequestContext([chunk]);
    const content = context.segments
      .flatMap((segment) => segment.messages.map((entry) => entry.content))
      .join('\n');

    expect(context.toolChoice).toBe('none');
    expect(content).toContain('chunkId 必须照抄输入里的 chunkId');
    expect(content).toContain(chunk.id);
    expect(content).toContain('sourceText:');
    expect(content).toContain('跨对话和向量要并列设置。');
    expect(content).not.toContain('sourceMessageIds');
  });
});

describe('parseMemorySemanticPreparationModelOutput', () => {
  it('parses fenced JSON organizer output', () => {
    expect(parseMemorySemanticPreparationModelOutput([
      '```json',
      '{"chunks":[{"chunkId":"chunk-1","title":"标题","keywords":["向量"],"summary":"摘要","semanticText":"语义"}]}',
      '```'
    ].join('\n'))).toEqual([{
      chunkId: 'chunk-1',
      title: '标题',
      keywords: ['向量'],
      summary: '摘要',
      semanticText: '语义'
    }]);
  });
});

describe('normalizeMemorySemanticPreparations', () => {
  it('preserves local source refs and ignores model-supplied unknown chunk ids', () => {
    const chunk = semanticChunk();
    const prepared = normalizeMemorySemanticPreparations({
      chunks: [chunk],
      now: 100,
      rawPreparations: [
        {
          chunkId: chunk.id,
          title: '跨对话向量边界',
          keywords: ['跨对话', '向量索引', '跨对话'],
          summary: '用户希望向量索引只在跨对话开启时存在。',
          semanticText: '跨对话记忆开启时可以有向量索引；关闭后不再保留该协作者的向量索引状态。'
        },
        {
          chunkId: 'model-invented-chunk',
          title: '不存在的来源',
          summary: '这条不能进入索引。',
          semanticText: '这条不能进入索引。'
        }
      ]
    });

    expect(prepared).toHaveLength(1);
    expect(prepared[0]).toMatchObject({
      id: `memory-semantic-preparation:${chunk.id}`,
      sourceChunkId: chunk.id,
      conversationId: 'old',
      sourceMessageIds: ['u1', 'u2', 'a1'],
      title: '跨对话向量边界',
      keywords: ['跨对话', '向量索引'],
      summary: '用户希望向量索引只在跨对话开启时存在。',
      semanticText: '跨对话记忆开启时可以有向量索引；关闭后不再保留该协作者的向量索引状态。',
      generator: 'small_model',
      generatedAt: 100
    });
    expect(prepared[0]?.sourceRefs.map((ref) => ref.messageId)).toEqual(['u1', 'u2', 'a1']);
  });

  it('falls back to local chunk material when the model omits optional fields', () => {
    const chunk = semanticChunk();
    const prepared = normalizeMemorySemanticPreparations({
      chunks: [chunk],
      now: 100,
      rawPreparations: [{
        chunkId: chunk.id,
        summary: '只返回摘要。'
      }]
    });

    expect(prepared[0]).toMatchObject({
      title: chunk.title,
      keywords: chunk.keywords,
      summary: '只返回摘要。',
      semanticText: '只返回摘要。'
    });
  });

  it('can prepare raw local chunks without model-generated summaries', () => {
    const chunk = semanticChunk();
    const prepared = prepareRawMemorySemanticChunks({
      chunks: [chunk],
      now: 200
    });

    expect(prepared[0]).toMatchObject({
      id: `memory-semantic-preparation:${chunk.id}`,
      sourceChunkId: chunk.id,
      conversationId: 'old',
      sourceMessageIds: ['u1', 'u2', 'a1'],
      title: chunk.title,
      keywords: chunk.keywords,
      summary: chunk.semanticText,
      semanticText: chunk.semanticText,
      generator: 'raw_source',
      generatedAt: 200
    });
  });
});
