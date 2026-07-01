import { describe, expect, it, vi } from 'vitest';
import { createPersonaTemplate } from '../config/persona/personaBuilder';
import type { Conversation, ProviderProfile } from '../types/domain';
import {
  parseConversationSummaryModelOutput,
  runConversationSummaryMemory,
  type ConversationSummaryRequestReply
} from './conversationSummaryRunner';

const baseProvider: ProviderProfile = {
  id: 'main-provider',
  name: 'Main Provider',
  protocol: 'openai-completions',
  baseUrl: 'https://api.example.test',
  path: '/v1/chat/completions',
  apiKey: 'key',
  model: 'main-model',
  capabilities: {
    images: false,
    streaming: false,
    thinking: false
  }
};

const smallProvider: ProviderProfile = {
  ...baseProvider,
  id: 'small-provider',
  name: 'Small Provider',
  model: 'small-default'
};

function createConversation(id: string, collaboratorId: string, content: string): Conversation {
  return {
    id,
    title: `对话 ${id}`,
    collaboratorId,
    messages: [{
      id: `${id}-m1`,
      role: 'user',
      content,
      timestamp: 100
    }],
    pinnedAt: null,
    updatedAt: 100
  };
}

describe('parseConversationSummaryModelOutput', () => {
  it('parses JSON objects even when providers wrap them in fences', () => {
    expect(parseConversationSummaryModelOutput('```json\n{"summaries":[{"kind":"recent_topic","content":"继续写记忆框架"}]}\n```')).toEqual([
      {
        kind: 'recent_topic',
        content: '继续写记忆框架'
      }
    ]);
  });

  it('parses readable draft sections into summary records', () => {
    expect(parseConversationSummaryModelOutput([
      '长期关系：',
      '- 用户希望跨对话记忆按协作者独立保存，不要混进其他协作者。',
      '',
      '近期主题：',
      '- 正在调整记忆页，把跨对话总结、长期资料、向量索引分成更清楚的子页。'
    ].join('\n'))).toEqual([
      {
        kind: 'relational_profile',
        title: '用户希望跨对话记忆按协作者独立保存，…',
        content: '用户希望跨对话记忆按协作者独立保存，不要混进其他协作者。'
      },
      {
        kind: 'recent_topic',
        title: '正在调整记忆页，把跨对话总结、长期资…',
        content: '正在调整记忆页，把跨对话总结、长期资料、向量索引分成更清楚的子页。'
      }
    ]);
  });
});

describe('runConversationSummaryMemory', () => {
  it('does not call the model when global summary generation is disabled', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>();

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'pharos',
        name: 'Pharos',
        description: ''
      }),
      conversations: [createConversation('c1', 'pharos', '用户想把记忆系统搭起来。')],
      settings: {
        enabled: false
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      requestReply
    });

    expect(result.status).toBe('disabled');
    expect(requestReply).not.toHaveBeenCalled();
  });

  it('summarizes only conversations that belong to the target collaborator', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments[params.context.segments.length - 1]?.messages[0]?.content;
      expect(typeof prompt === 'string' ? prompt : '').toContain('用户想把记忆系统搭起来');
      expect(typeof prompt === 'string' ? prompt : '').not.toContain('其他协作者的对话');
      expect(typeof prompt === 'string' ? prompt : '').toContain('名字表：用户 = 历史来源中 role:user 的说话人');
      expect(typeof prompt === 'string' ? prompt : '').toContain('先做对象确认');
      expect(typeof prompt === 'string' ? prompt : '').toContain('不要用“我/你/他/她/用户/助手/协作者”指代关系主体');
      return {
        content: JSON.stringify({
          summaries: [{
            kind: 'relational_profile',
            title: '记忆偏好',
            content: '用户希望跨对话记忆按协作者单独保存。',
            sourceConversationIds: ['forged']
          }]
        })
      };
    });

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'pharos',
        name: 'Pharos',
        description: ''
      }),
      conversations: [
        createConversation('c1', 'pharos', '用户想把记忆系统搭起来。'),
        createConversation('c2', 'other', '其他协作者的对话不应该进来。')
      ],
      settings: {
        enabled: true,
        providerId: 'small-provider',
        modelOverride: 'summary-model'
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      requestReply,
      now: 1234
    });

    expect(result.status).toBe('completed');
    expect(result.providerId).toBe('small-provider');
    expect(result.model).toBe('summary-model');
    expect(result.generatedCount).toBe(1);
    expect(result.summaries[0]).toMatchObject({
      kind: 'relational_profile',
      title: '记忆偏好',
      content: '用户希望跨对话记忆按协作者单独保存。',
      sourceConversationIds: ['c1'],
      sourceMessageIds: ['c1-m1'],
      subjectCollaboratorId: 'pharos',
      subjectCollaboratorName: 'Pharos',
      userLabel: '用户',
      generator: 'small_model',
      generatedAt: 1234,
      updatedAt: 1234
    });
    expect(requestReply.mock.calls[0]?.[0].api).toMatchObject({
      id: 'small-provider',
      model: 'summary-model'
    });
  });

  it('anchors source roles and stored summaries to the target collaborator name', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = String(params.context.segments[params.context.segments.length - 1]?.messages[0]?.content ?? '');
      expect(prompt).toContain('Nova Previous Chat · Nova ·');
      expect(prompt).toContain('Nova Previous Chat · 用户 ·');
      expect(prompt).not.toContain('assistant / 当前协作者');
      expect(prompt).not.toContain('user / 用户');
      expect(prompt).toContain('名字表：用户 = 历史来源中 role:user 的说话人；Nova = 历史来源中 role:assistant 的说话人。');
      expect(prompt).toContain('总结必须使用名字表里的明确名字：“用户”、“Nova”、“双方”');
      return {
        content: JSON.stringify({
          summaries: [{
            kind: 'relational_profile',
            title: '关系画像',
            content: '用户和 Nova 的关系画像需要保留明确对象。'
          }]
        })
      };
    });

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'nova',
        name: 'Nova',
        description: ''
      }),
      conversations: [{
        id: 'c-nova',
        title: 'Nova Previous Chat',
        collaboratorId: 'nova',
        messages: [
          {
            id: 'c-nova-user',
            role: 'user',
            content: '我想让你记得这件事。',
            timestamp: 100
          },
          {
            id: 'c-nova-assistant',
            role: 'assistant',
            content: '我会记得。',
            timestamp: 101
          }
        ],
        pinnedAt: null,
        updatedAt: 101
      }],
      settings: {
        enabled: true
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      requestReply,
      now: 5678
    });

    expect(result.summaries[0]).toMatchObject({
      title: '关系画像',
      subjectCollaboratorId: 'nova',
      subjectCollaboratorName: 'Nova',
      userLabel: '用户',
      sourceMessageIds: ['c-nova-user', 'c-nova-assistant']
    });
  });

  it('falls back to the active global provider when the configured provider is missing', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async () => ({
      content: '{"summaries":[{"kind":"recent_topic","title":"任务","content":"继续完成总结小模型。"}]}'
    }));

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'pharos',
        name: 'Pharos',
        description: ''
      }),
      conversations: [createConversation('c1', 'pharos', '继续完成总结小模型。')],
      settings: {
        enabled: true,
        providerId: 'missing-provider'
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      requestReply
    });

    expect(result.providerId).toBe('main-provider');
    expect(result.model).toBe('main-model');
    expect(requestReply.mock.calls[0]?.[0].api.id).toBe('main-provider');
  });

  it('keeps generated summary batches compact even when the model over-produces', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments[params.context.segments.length - 1]?.messages[0]?.content;
      expect(typeof prompt === 'string' ? prompt : '').toContain('每批最多输出 1 条长期关系和 4 条近期主题');
      return {
        content: JSON.stringify({
          summaries: [
            { kind: 'relational_profile', title: '画像 1', content: '第一条长期画像。' },
            { kind: 'relational_profile', title: '画像 2', content: '第二条长期画像不应该写入。' },
            { kind: 'recent_topic', title: '事项 1', content: '近期事项一。' },
            { kind: 'recent_topic', title: '事项 2', content: '近期事项二。' },
            { kind: 'recent_topic', title: '事项 3', content: '近期事项三。' },
            { kind: 'recent_topic', title: '事项 4', content: '近期事项四。' },
            { kind: 'recent_topic', title: '事项 5', content: '第五条近期事项不应该写入。' }
          ]
        })
      };
    });

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'pharos',
        name: 'Pharos',
        description: ''
      }),
      conversations: [createConversation('c1', 'pharos', '继续完成总结小模型。')],
      settings: {
        enabled: true
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      requestReply
    });

    expect(result.generatedCount).toBe(5);
    expect(result.summaries.map((summary) => summary.title)).toEqual([
      '画像 1',
      '事项 1',
      '事项 2',
      '事项 3',
      '事项 4'
    ]);
  });

  it('skips malformed organizer JSON without failing the whole summary run', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments[params.context.segments.length - 1]?.messages[0]?.content ?? '';
      if (typeof prompt === 'string' && prompt.includes('第一批会坏掉')) {
        return {
          content: '{"summaries":[{"kind":"recent_topic","content":'
        };
      }
      return {
        content: '{"summaries":[{"kind":"recent_topic","title":"可用批次","content":"第二批仍然应该写入总结。"}]}'
      };
    });

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'pharos',
        name: 'Pharos',
        description: ''
      }),
      conversations: [
        createConversation('c1', 'pharos', '第一批会坏掉。'),
        createConversation('c2', 'pharos', '第二批仍然应该进入总结。')
      ],
      settings: {
        enabled: true,
        targetSourceChars: 80
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      requestReply,
      now: 4321
    });

    expect(result.status).toBe('completed');
    expect(result.batchCount).toBe(2);
    expect(result.generatedCount).toBe(1);
    expect(result.summaries[0]).toMatchObject({
      title: '可用批次',
      content: '第二批仍然应该写入总结。',
      sourceConversationIds: ['c2']
    });
  });

  it('reports source and batch progress while summarizing', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments[params.context.segments.length - 1]?.messages[0]?.content ?? '';
      return {
        content: JSON.stringify({
          summaries: [{
            kind: 'recent_topic',
            title: typeof prompt === 'string' && prompt.includes('第一批') ? '第一批' : '第二批',
            content: '进度事件应该和批次推进保持一致。'
          }]
        })
      };
    });
    const progressStages: string[] = [];
    const completedBatches: number[] = [];

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'pharos',
        name: 'Pharos',
        description: ''
      }),
      conversations: [
        createConversation('c1', 'pharos', '第一批会进入整理。'),
        createConversation('c2', 'pharos', '第二批也会进入整理。')
      ],
      settings: {
        enabled: true,
        targetSourceChars: 80
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      requestReply,
      onProgress: (progress) => {
        progressStages.push(progress.stage);
        completedBatches.push(progress.completedBatches);
        expect(progress.sourceConversationCount).toBe(2);
        expect(progress.sourceMessageCount).toBe(2);
      }
    });

    expect(result.batchCount).toBe(2);
    expect(result.generatedCount).toBe(2);
    expect(progressStages).toEqual([
      'planning',
      'summarizing',
      'summarizing',
      'summarizing',
      'summarizing',
      'summarized'
    ]);
    expect(completedBatches).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('resumes from existing small-model summaries and only runs missing batches', async () => {
    const existingSummary = {
      id: 'existing-summary',
      kind: 'recent_topic' as const,
      title: '已有批次',
      content: '第一批已经整理过，下次不应该重跑。',
      sequence: 100,
      sourceConversationIds: ['c1'],
      sourceMessageIds: ['c1-m1'],
      sourceCharCount: 1,
      generator: 'small_model' as const,
      generatedAt: 1,
      updatedAt: 1
    };
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments[params.context.segments.length - 1]?.messages[0]?.content ?? '';
      expect(String(prompt)).not.toContain('第一批已经整理过');
      expect(String(prompt)).toContain('第二批需要补上');
      return {
        content: JSON.stringify({
          summaries: [{
            kind: 'recent_topic',
            title: '补上的批次',
            content: '第二批现在补齐。'
          }]
        })
      };
    });
    const progress: Array<[number, number]> = [];
    const batchWrites: string[][] = [];

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'pharos',
        name: 'Pharos',
        description: ''
      }),
      conversations: [
        createConversation('c1', 'pharos', '第一批已经整理过。'),
        createConversation('c2', 'pharos', '第二批需要补上。')
      ],
      settings: {
        enabled: true,
        targetSourceChars: 80
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      existingSummaries: [existingSummary],
      requestReply,
      now: 999,
      onBatchSummaries: (summaries) => {
        batchWrites.push(summaries.flatMap((summary) => summary.sourceMessageIds));
      },
      onProgress: (item) => {
        progress.push([item.completedBatches, item.totalBatches]);
      }
    });

    expect(result.status).toBe('completed');
    expect(result.batchCount).toBe(2);
    expect(result.generatedCount).toBe(2);
    expect(result.summaries.map((summary) => summary.id)).toContain('existing-summary');
    expect(result.summaries.map((summary) => summary.title)).toEqual(['已有批次', '补上的批次']);
    expect(requestReply).toHaveBeenCalledTimes(1);
    expect(batchWrites).toEqual([['c2-m1']]);
    expect(progress[0]).toEqual([1, 2]);
    expect(progress[progress.length - 1]).toEqual([2, 2]);
  });

  it('skips suppressed source batches when skip processed is enabled', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments[params.context.segments.length - 1]?.messages[0]?.content ?? '';
      expect(String(prompt)).not.toContain('这批被用户删过');
      expect(String(prompt)).toContain('这批仍然需要整理');
      return {
        content: JSON.stringify({
          summaries: [{
            kind: 'recent_topic',
            title: '保留批次',
            content: '未处理批次已经整理。'
          }]
        })
      };
    });

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'pharos',
        name: 'Pharos',
        description: ''
      }),
      conversations: [
        createConversation('c1', 'pharos', '这批被用户删过。'),
        createConversation('c2', 'pharos', '这批仍然需要整理。')
      ],
      settings: {
        enabled: true,
        skipProcessedSources: true,
        targetSourceChars: 80
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      suppressedSources: [{
        id: 'suppressed-c1',
        sourceConversationIds: ['c1'],
        sourceMessageIds: ['c1-m1'],
        sourceCharCount: 10,
        reason: 'user_deleted',
        suppressedAt: 100
      }],
      requestReply,
      now: 999
    });

    expect(result.status).toBe('completed');
    expect(requestReply).toHaveBeenCalledTimes(1);
    expect(result.summaries.map((summary) => summary.title)).toEqual(['保留批次']);
  });

  it('rescans existing summaries and suppressed batches when skip processed is disabled', async () => {
    const existingSummary = {
      id: 'existing-summary',
      kind: 'recent_topic' as const,
      title: '已有批次',
      content: '这条会被重扫替换。',
      sequence: 100,
      sourceConversationIds: ['c1'],
      sourceMessageIds: ['c1-m1'],
      sourceCharCount: 1,
      generator: 'small_model' as const,
      generatedAt: 1,
      updatedAt: 1
    };
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments[params.context.segments.length - 1]?.messages[0]?.content ?? '';
      expect(String(prompt)).toContain('这批虽然处理过，但现在要重扫');
      return {
        content: JSON.stringify({
          summaries: [{
            kind: 'recent_topic',
            title: '重扫批次',
            content: '已处理批次被重新整理。'
          }]
        })
      };
    });

    const result = await runConversationSummaryMemory({
      persona: createPersonaTemplate({
        id: 'pharos',
        name: 'Pharos',
        description: ''
      }),
      conversations: [
        createConversation('c1', 'pharos', '这批虽然处理过，但现在要重扫。')
      ],
      settings: {
        enabled: true,
        skipProcessedSources: false,
        targetSourceChars: 80
      },
      providers: [smallProvider],
      globalApi: baseProvider,
      existingSummaries: [existingSummary],
      suppressedSources: [{
        id: 'suppressed-c1',
        sourceConversationIds: ['c1'],
        sourceMessageIds: ['c1-m1'],
        sourceCharCount: 10,
        reason: 'user_deleted',
        suppressedAt: 100
      }],
      requestReply,
      now: 999
    });

    expect(result.status).toBe('completed');
    expect(requestReply).toHaveBeenCalledTimes(1);
    expect(result.summaries.map((summary) => summary.title)).toEqual(['重扫批次']);
  });
});
