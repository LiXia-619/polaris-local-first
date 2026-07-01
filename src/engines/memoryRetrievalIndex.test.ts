import { describe, expect, it } from 'vitest';
import {
  buildConversationSemanticChunks,
  buildConversationRetrievalChunks,
  normalizeMemoryRetrievalText,
  searchMemoryRetrievalChunks,
  tokenizeMemoryRetrievalQuery
} from './memoryRetrievalIndex';
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
    timestamp: seed.timestamp,
    origin: seed.origin,
    toolInvocation: seed.toolInvocation,
    cardReference: seed.cardReference
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

describe('normalizeMemoryRetrievalText', () => {
  it('normalizes case, width, and whitespace for stable local search', () => {
    expect(normalizeMemoryRetrievalText('  ＴＥＳＴ  UV   Sensitive  ')).toBe('test uv sensitive');
  });
});

describe('tokenizeMemoryRetrievalQuery', () => {
  it('keeps ascii terms and cjk overlap terms for mixed queries', () => {
    expect(tokenizeMemoryRetrievalQuery('用户 紫外线敏感 UV')).toEqual(expect.arrayContaining([
      '用户',
      'uv',
      '紫外',
      '外线',
      '线敏',
      '敏感'
    ]));
    expect(tokenizeMemoryRetrievalQuery('用户 紫外线敏感 UV')).toEqual(expect.arrayContaining([
      '紫外线',
      '线敏感'
    ]));
  });

  it('drops common pronouns and particles from local recall terms', () => {
    expect(tokenizeMemoryRetrievalQuery('我 你 他的 这个 那个 生日 记忆')).toEqual([
      '生日',
      '记忆'
    ]);
  });
});

describe('buildConversationRetrievalChunks', () => {
  it('builds source-backed chunks while excluding the active conversation', () => {
    const chunks = buildConversationRetrievalChunks({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      conversations: [
        conversation({
          id: 'active',
          title: '当前对话',
          messages: [message({ id: 'active-user', content: '当前轮不应该进入跨对话索引。', timestamp: 20 })]
        }),
        conversation({
          id: 'old',
          title: '旧对话',
          messages: [message({ id: 'old-user', content: '用户 说过紫外线敏感。', timestamp: 10 })]
        })
      ]
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      kind: 'source_message',
      conversationId: 'old',
      sourceMessageIds: ['old-user'],
      sourceRefs: [{
        conversationId: 'old',
        messageId: 'old-user',
        role: 'user',
        timestamp: 10
      }],
      exactText: '用户 说过紫外线敏感。'
    });
  });

  it('keeps chunks scoped to the active collaborator', () => {
    const chunks = buildConversationRetrievalChunks({
      currentCollaboratorId: 'pharos',
      conversations: [
        conversation({
          id: 'same',
          title: '同协作者',
          collaboratorId: 'pharos',
          messages: [message({ id: 'same-user', content: '这条可以被当前协作者召回。', timestamp: 1 })]
        }),
        conversation({
          id: 'other',
          title: '其他协作者',
          collaboratorId: 'nova',
          messages: [message({ id: 'other-user', content: '这条不属于当前协作者。', timestamp: 2 })]
        })
      ]
    });

    expect(chunks.map((chunk) => chunk.conversationId)).toEqual(['same']);
  });

  it('does not index tool-runtime debris', () => {
    const chunks = buildConversationRetrievalChunks({
      conversations: [
        conversation({
          id: 'old',
          title: '工具记录',
          messages: [
            message({
              id: 'tool',
              role: 'assistant',
              content: '工具执行结果不应该变成回忆正文。',
              timestamp: 2,
              origin: 'tool-runtime'
            }),
            message({
              id: 'natural',
              role: 'assistant',
              content: '自然助手回复可以作为旧对话材料。',
              timestamp: 3
            })
          ]
        })
      ]
    });

    expect(chunks.map((chunk) => chunk.sourceMessageIds[0])).toEqual(['natural']);
  });

  it('does not index generated continuation prompts as recall memory', () => {
    const chunks = buildConversationRetrievalChunks({
      conversations: [
        conversation({
          id: 'old',
          title: '续接入口',
          messages: [
            message({
              id: 'length-followup',
              content: [
                '上一条回答在中途停住了，可能是输出长度到顶，也可能是流式连接提前结束。',
                '不要重头开始，不要道歉，不要复述前文。',
                '直接从刚才断开的那一句继续，但只接下一小段。'
              ].join(' '),
              timestamp: 1,
              origin: 'system-note'
            }),
            message({
              id: 'card-continue',
              content: '继续沿着这张卡往下写。',
              timestamp: 2,
              cardReference: {
                id: 'card-1',
                title: '卡片',
                language: 'text',
                code: '正文',
                mode: 'continue'
              }
            }),
            message({
              id: 'natural',
              content: '用户自己说的继续聊最近事项仍然是自然表达。',
              timestamp: 3
            })
          ]
        })
      ]
    });

    expect(chunks.map((chunk) => chunk.sourceMessageIds[0])).toEqual(['natural']);
  });
});

describe('buildConversationSemanticChunks', () => {
  it('groups a user burst with the following assistant replies as one dialogue turn', () => {
    const chunks = buildConversationSemanticChunks({
      currentCollaboratorId: 'pharos',
      conversations: [
        conversation({
          id: 'old',
          title: '向量索引讨论',
          messages: [
            message({ id: 'u1', content: '跨对话和向量要并列设置。', timestamp: 1 }),
            message({ id: 'u2', content: '但关掉跨对话就不要保留向量。', timestamp: 2 }),
            message({
              id: 'a1',
              role: 'assistant',
              content: '我会把向量索引挂在跨对话开关下面。',
              timestamp: 3
            }),
            message({ id: 'u3', content: '语义怎么切？', timestamp: 4 })
          ]
        })
      ]
    });

    expect(chunks.map((chunk) => chunk.sourceMessageIds)).toEqual([
      ['u3'],
      ['u1', 'u2', 'a1']
    ]);
    expect(chunks[1]).toMatchObject({
      kind: 'dialogue_turn',
      conversationId: 'old',
      title: '向量索引讨论 · 1970-01-01 · 对话轮',
      exactText: [
        'user: 跨对话和向量要并列设置。',
        'user: 但关掉跨对话就不要保留向量。',
        'assistant: 我会把向量索引挂在跨对话开关下面。'
      ].join('\n\n')
    });
  });

  it('keeps a standalone long user intent as its own source-backed semantic unit', () => {
    const chunks = buildConversationSemanticChunks({
      conversations: [
        conversation({
          id: 'old',
          title: '产品判断',
          messages: [
            message({
              id: 'u1',
              content: '我真正想要的不是机械摘要，而是能在别的窗口里重新认出同一个人的说话方式。',
              timestamp: 10
            })
          ]
        })
      ]
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      kind: 'user_intent',
      sourceMessageIds: ['u1'],
      exactText: '我真正想要的不是机械摘要，而是能在别的窗口里重新认出同一个人的说话方式。'
    });
  });

  it('excludes the active conversation, other collaborators, and orphan assistant messages', () => {
    const chunks = buildConversationSemanticChunks({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      conversations: [
        conversation({
          id: 'active',
          title: '当前对话',
          messages: [message({ id: 'active-user', content: '当前消息不能进跨对话语义块。', timestamp: 4 })]
        }),
        conversation({
          id: 'other',
          title: '其他协作者',
          collaboratorId: 'nova',
          messages: [message({ id: 'other-user', content: '其他协作者的内容不进当前块。', timestamp: 3 })]
        }),
        conversation({
          id: 'old',
          title: '旧对话',
          messages: [
            message({
              id: 'orphan',
              role: 'assistant',
              content: '没有用户意图来源的助手孤句不单独生成语义块。',
              timestamp: 1
            }),
            message({ id: 'old-user', content: '这条才是有效语义来源。', timestamp: 2 })
          ]
        })
      ]
    });

    expect(chunks.map((chunk) => chunk.sourceMessageIds)).toEqual([['old-user']]);
  });
});

describe('searchMemoryRetrievalChunks', () => {
  it('returns exact source-backed results for hard facts', () => {
    const chunks = buildConversationRetrievalChunks({
      currentCollaboratorId: 'pharos',
      conversations: [
        conversation({
          id: 'old',
          title: '防晒讨论',
          messages: [
            message({
              id: 'old-user',
              content: '用户 的日晒反应更适合理解为轻度紫外线敏感。',
              timestamp: 10
            })
          ]
        })
      ]
    });
    const results = searchMemoryRetrievalChunks({
      query: '紫外线敏感',
      chunks
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      matchKind: 'exact_phrase',
      authority: 'raw_source',
      chunk: {
        conversationId: 'old',
        sourceMessageIds: ['old-user'],
        exactText: '用户 的日晒反应更适合理解为轻度紫外线敏感。'
      }
    });
    expect(results[0]?.matchedKeywords).toEqual(expect.arrayContaining(['紫外', '外线', '线敏', '敏感']));
  });

  it('can find related material through keyword overlap without rewriting the source text', () => {
    const chunks = buildConversationRetrievalChunks({
      conversations: [
        conversation({
          id: 'old',
          title: '记忆地基',
          messages: [
            message({
              id: 'old-user',
              content: '聊天原文是最终权威，摘要和关键词只是索引材料。',
              timestamp: 10
            })
          ]
        })
      ]
    });
    const results = searchMemoryRetrievalChunks({
      query: '关键词 原文',
      chunks
    });

    expect(results[0]?.matchKind).toBe('keyword_overlap');
    expect(results[0]?.chunk.exactText).toBe('聊天原文是最终权威，摘要和关键词只是索引材料。');
    expect(results[0]?.chunk.semanticText).toContain('聊天原文是最终权威');
  });

  it('boosts object anchors in local retrieval scoring', () => {
    const chunks = buildConversationRetrievalChunks({
      conversations: [
        conversation({
          id: 'claude',
          title: 'Claude 讨论',
          updatedAt: 1,
          messages: [
            message({
              id: 'claude-user',
              content: 'Claude 相关的原话应该被专有对象锚点召回。',
              timestamp: 1
            })
          ]
        }),
        conversation({
          id: 'generic',
          title: '普通模型讨论',
          updatedAt: 50,
          messages: [
            message({
              id: 'generic-user',
              content: '模型选择怎么处理，这个也聊过。',
              timestamp: 50
            })
          ]
        })
      ]
    });
    const results = searchMemoryRetrievalChunks({
      query: 'Claude 模型怎么处理',
      chunks
    });

    expect(results[0]).toEqual(expect.objectContaining({
      matchedKeywords: expect.arrayContaining(['claude']),
      chunk: expect.objectContaining({ conversationId: 'claude' })
    }));
  });
});
