import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePersonaStore } from '../../stores/personaStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import type { Conversation, PersonaConversationSummary, ProviderProfile } from '../../types/domain';
import { updateConversationSummaryMemoryForCollaborator } from './conversationSummaryMemoryActions';
import type { ConversationSummaryRequestReply } from '../../engines/conversationSummaryRunner';
import {
  buildChatDomainMetaLocalDataRow,
  buildConversationLocalDataProjection,
  getChatDomainMetaLocalDataRef,
  getConversationCatalogLocalDataRef,
  getConversationRecordLocalDataRef,
  getLocalDataRowKey
} from '../../engines/localData';

const persistence = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const kvKeys = vi.fn(async () => [...values.keys()]);
  const kvKeysWithPrefix = vi.fn(async (prefix: string) => [...values.keys()].filter((key) => key.startsWith(prefix)));
  const kvGet = vi.fn(async (key: string) => values.get(key) ?? null);
  const kvApplyMutations = vi.fn(async () => undefined);
  const getPersistenceLocalDataCommitMode = vi.fn(() => 'transactional');
  return {
    values,
    kvKeys,
    kvKeysWithPrefix,
    kvGet,
    kvApplyMutations,
    getPersistenceLocalDataCommitMode
  };
});

vi.mock('../../infrastructure/persistence', () => ({
  kvKeys: persistence.kvKeys,
  kvKeysWithPrefix: persistence.kvKeysWithPrefix,
  kvGet: persistence.kvGet,
  kvApplyMutations: persistence.kvApplyMutations,
  getPersistenceLocalDataCommitMode: persistence.getPersistenceLocalDataCommitMode
}));

const provider: ProviderProfile = {
  id: 'provider-a',
  name: 'Provider A',
  protocol: 'openai-completions',
  baseUrl: 'https://api.example.test',
  path: '/v1/chat/completions',
  apiKey: 'key',
  model: 'summary-model',
  capabilities: {
    images: false,
    streaming: false,
    thinking: false
  }
};

function createConversation(content = '用户 想让每个协作者有自己的跨对话记忆。', id = 'c1'): Conversation {
  return {
    id,
    title: '记忆讨论',
    collaboratorId: 'aa',
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

function seedLiveChatState(input: Conversation | Conversation[] = createConversation()) {
  const conversations = Array.isArray(input) ? input : [input];
  const now = Math.max(...conversations.map((conversation) => conversation.updatedAt));
  const domainMeta = buildChatDomainMetaLocalDataRow({
    activeConversationId: conversations[0]?.id ?? '',
    activeConversationCount: conversations.length,
    quarantinedConversationCount: 0,
    totalConversationCount: conversations.length,
    version: 1,
    updatedAt: now
  });

  persistence.values.set(getLocalDataRowKey(getChatDomainMetaLocalDataRef()), domainMeta);
  conversations.forEach((conversation) => {
    const projection = buildConversationLocalDataProjection({
      conversation,
      bodyState: 'complete',
      version: 1,
      committedAt: conversation.updatedAt
    });
    persistence.values.set(getLocalDataRowKey(getConversationCatalogLocalDataRef(conversation.id)), projection.catalogRow);
    if (projection.recordRow) {
      persistence.values.set(getLocalDataRowKey(getConversationRecordLocalDataRef(conversation.id)), projection.recordRow);
    }
  });
}

describe('updateConversationSummaryMemoryForCollaborator', () => {
  beforeEach(() => {
    persistence.values.clear();
    persistence.kvKeys.mockClear();
    persistence.kvKeysWithPrefix.mockClear();
    persistence.kvGet.mockClear();
    persistence.kvApplyMutations.mockClear();

    const manualSummary: PersonaConversationSummary = {
      id: 'manual-1',
      kind: 'relational_profile',
      title: '手写记忆',
      content: '这条手写记忆应该保留。',
      sequence: 1,
      sourceConversationIds: [],
      sourceMessageIds: [],
      sourceCharCount: 0,
      generator: 'manual',
      generatedAt: 1,
      updatedAt: 1
    };
    const staleSmallSummary: PersonaConversationSummary = {
      ...manualSummary,
      id: 'small-old',
      title: '旧小模型记忆',
      content: '这条旧小模型记忆应该被替换。',
      generator: 'small_model'
    };

    useRuntimeStore.setState({
      providers: [provider],
      activeProviderId: provider.id,
      conversationSummaryModel: {
        enabled: true,
        skipProcessedSources: true,
        providerId: provider.id,
        modelOverride: '',
        targetSourceChars: 50_000,
        lastUpdatedAt: 0
      },
      hydrated: true,
      persistToDb: vi.fn(async () => undefined)
    });
    usePersonaStore.setState({
      personas: [
        createPersonaTemplate({
          id: 'aa',
          name: '用户',
          description: '',
          memory: {
            conversationSummaries: [manualSummary, staleSmallSummary]
          }
        })
      ],
      activeCollaboratorId: 'aa',
      hydrated: true,
      persistToDb: vi.fn(async () => undefined)
    });
    seedLiveChatState(createConversation('用户 想让每个协作者有自己的跨对话记忆。'));
    const ensureFullConversationBodiesLoaded = vi.fn(async () => {
      throw new Error('derived work should not hydrate chat store');
    });
    useChatStore.setState({
      conversations: [createConversation()],
      activeConversationId: 'c1',
      hydrated: true,
      dirtyConversationIds: [],
      deletedConversationIds: [],
      loadingMessageConversationIds: [],
      ensureFullConversationBodiesLoaded
    });
    useCollectionStore.setState({
      hydrated: true
    });
  });

  it('writes new small-model summaries to the target collaborator and preserves manual summaries', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async () => ({
      content: '{"summaries":[{"kind":"relational_profile","title":"协作者记忆","content":"用户 希望跨对话记忆按协作者独立保存。"}]}'
    }));

    const result = await updateConversationSummaryMemoryForCollaborator('aa', {
      requestReply,
      now: 4321
    });
    const persona = usePersonaStore.getState().personas.find((item) => item.id === 'aa');

    expect(result.status).toBe('completed');
    expect(persona?.memory.conversationSummaries).toHaveLength(2);
    expect(persona?.memory.conversationSummaries.map((summary) => summary.content)).toEqual([
      '这条手写记忆应该保留。',
      '用户 希望跨对话记忆按协作者独立保存。'
    ]);
    expect(persona?.memory.conversationSummaries[1]).toMatchObject({
      generator: 'small_model',
      sourceConversationIds: ['c1'],
      sourceMessageIds: ['c1-m1']
    });
    expect(usePersonaStore.getState().persistToDb).toHaveBeenCalled();
    expect(useRuntimeStore.getState().persistToDb).toHaveBeenCalled();
    expect(useChatStore.getState().ensureFullConversationBodiesLoaded).not.toHaveBeenCalled();
    expect(requestReply.mock.calls[0]?.[0].context.segments.flatMap((segment) =>
      segment.messages.map((message) => message.content)
    ).join('\n')).toContain('用户 想让每个协作者有自己的跨对话记忆。');
  });

  it('persists completed summary batches and resumes the missing batch after a failed run', async () => {
    const manualSummary: PersonaConversationSummary = {
      id: 'manual-1',
      kind: 'relational_profile',
      title: '手写记忆',
      content: '这条手写记忆应该保留。',
      sequence: 1,
      sourceConversationIds: [],
      sourceMessageIds: [],
      sourceCharCount: 0,
      generator: 'manual',
      generatedAt: 1,
      updatedAt: 1
    };
    usePersonaStore.setState({
      personas: [
        createPersonaTemplate({
          id: 'aa',
          name: '用户',
          description: '',
          memory: {
            conversationSummaries: [manualSummary]
          }
        })
      ],
      activeCollaboratorId: 'aa',
      hydrated: true,
      persistToDb: vi.fn(async () => undefined)
    });
    const conversations = [
      createConversation('第一批应该先保存下来。', 'c1'),
      createConversation('第二批第一次会超时，下一次再补。', 'c2')
    ];
    seedLiveChatState(conversations);
    useRuntimeStore.setState({
      conversationSummaryModel: {
        enabled: true,
        providerId: provider.id,
        modelOverride: '',
        targetSourceChars: 80,
        lastUpdatedAt: 0
      }
    });
    let callCount = 0;
    const firstRunReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      callCount += 1;
      const prompt = params.context.segments.flatMap((segment) => segment.messages.map((message) => message.content)).join('\n');
      if (callCount === 1) {
        expect(prompt).toContain('第一批应该先保存下来');
        return {
          content: '{"summaries":[{"kind":"recent_topic","title":"第一批","content":"第一批已经保存。"}]}'
        };
      }
      expect(prompt).toContain('第二批第一次会超时');
      throw new Error('流式响应超时，请重试。');
    });

    await expect(updateConversationSummaryMemoryForCollaborator('aa', {
      requestReply: firstRunReply,
      now: 1000
    })).rejects.toThrow('流式响应超时');
    let persona = usePersonaStore.getState().personas.find((item) => item.id === 'aa');

    expect(persona?.memory.conversationSummaries.map((summary) => summary.title)).toEqual([
      '手写记忆',
      '第一批'
    ]);
    expect(useRuntimeStore.getState().conversationSummaryModel.lastUpdatedAt).toBe(0);

    const secondRunReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments.flatMap((segment) => segment.messages.map((message) => message.content)).join('\n');
      expect(prompt).not.toContain('第一批应该先保存下来');
      expect(prompt).toContain('第二批第一次会超时');
      return {
        content: '{"summaries":[{"kind":"recent_topic","title":"第二批","content":"第二批已经补齐。"}]}'
      };
    });

    const result = await updateConversationSummaryMemoryForCollaborator('aa', {
      requestReply: secondRunReply,
      now: 2000
    });
    persona = usePersonaStore.getState().personas.find((item) => item.id === 'aa');

    expect(result.status).toBe('completed');
    expect(secondRunReply).toHaveBeenCalledTimes(1);
    expect(persona?.memory.conversationSummaries.map((summary) => summary.title)).toEqual([
      '手写记忆',
      '第一批',
      '第二批'
    ]);
    expect(useRuntimeStore.getState().conversationSummaryModel.lastUpdatedAt).toBeGreaterThan(0);
  });

  it('skips deleted summary sources while skip processed is enabled', async () => {
    usePersonaStore.setState({
      personas: [
        createPersonaTemplate({
          id: 'aa',
          name: '用户',
          description: '',
          memory: {
            conversationSummaries: [],
            conversationSummarySuppressions: [{
              id: 'suppressed-c1',
              sourceConversationIds: ['c1'],
              sourceMessageIds: ['c1-m1'],
              sourceCharCount: 12,
              reason: 'user_deleted',
              suppressedAt: 1000
            }]
          }
        })
      ],
      activeCollaboratorId: 'aa',
      hydrated: true,
      persistToDb: vi.fn(async () => undefined)
    });
    const conversations = [
      createConversation('删掉过的批次不应该回来。', 'c1'),
      createConversation('新的批次应该整理。', 'c2')
    ];
    seedLiveChatState(conversations);
    useRuntimeStore.setState({
      conversationSummaryModel: {
        enabled: true,
        skipProcessedSources: true,
        providerId: provider.id,
        modelOverride: '',
        targetSourceChars: 80,
        lastUpdatedAt: 0
      }
    });
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments.flatMap((segment) => segment.messages.map((message) => message.content)).join('\n');
      expect(prompt).not.toContain('删掉过的批次不应该回来');
      expect(prompt).toContain('新的批次应该整理');
      return {
        content: '{"summaries":[{"kind":"recent_topic","title":"新批次","content":"新的批次已经整理。"}]}'
      };
    });

    const result = await updateConversationSummaryMemoryForCollaborator('aa', {
      requestReply,
      now: 3000
    });
    const persona = usePersonaStore.getState().personas.find((item) => item.id === 'aa');

    expect(result.status).toBe('completed');
    expect(requestReply).toHaveBeenCalledTimes(1);
    expect(persona?.memory.conversationSummaries.map((summary) => summary.title)).toEqual(['新批次']);
    expect((persona?.memory.conversationSummarySuppressions ?? []).map((suppression) => suppression.id)).toEqual(['suppressed-c1']);
  });

  it('rescans deleted summary sources when skip processed is disabled', async () => {
    usePersonaStore.setState({
      personas: [
        createPersonaTemplate({
          id: 'aa',
          name: '用户',
          description: '',
          memory: {
            conversationSummaries: [],
            conversationSummarySuppressions: [{
              id: 'suppressed-c1',
              sourceConversationIds: ['c1'],
              sourceMessageIds: ['c1-m1'],
              sourceCharCount: 12,
              reason: 'user_deleted',
              suppressedAt: 1000
            }]
          }
        })
      ],
      activeCollaboratorId: 'aa',
      hydrated: true,
      persistToDb: vi.fn(async () => undefined)
    });
    seedLiveChatState(createConversation('关掉跳过后应该允许重新整理。', 'c1'));
    useRuntimeStore.setState({
      conversationSummaryModel: {
        enabled: true,
        skipProcessedSources: false,
        providerId: provider.id,
        modelOverride: '',
        targetSourceChars: 80,
        lastUpdatedAt: 0
      }
    });
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async (params) => {
      const prompt = params.context.segments.flatMap((segment) => segment.messages.map((message) => message.content)).join('\n');
      expect(prompt).toContain('关掉跳过后应该允许重新整理');
      return {
        content: '{"summaries":[{"kind":"recent_topic","title":"重扫批次","content":"被删过的来源已经重扫。"}]}'
      };
    });

    const result = await updateConversationSummaryMemoryForCollaborator('aa', {
      requestReply,
      now: 4000
    });
    const persona = usePersonaStore.getState().personas.find((item) => item.id === 'aa');

    expect(result.status).toBe('completed');
    expect(requestReply).toHaveBeenCalledTimes(1);
    expect(persona?.memory.conversationSummaries.map((summary) => summary.title)).toEqual(['重扫批次']);
    expect(persona?.memory.conversationSummarySuppressions).toEqual([]);
  });

  it('keeps previous generated summaries when the current run produces no usable summaries', async () => {
    const requestReply = vi.fn<ConversationSummaryRequestReply>(async () => ({
      content: '{"summaries":[{"kind":"recent_topic","content":'
    }));

    const result = await updateConversationSummaryMemoryForCollaborator('aa', {
      requestReply,
      now: 4321
    });
    const persona = usePersonaStore.getState().personas.find((item) => item.id === 'aa');

    expect(result.status).toBe('completed');
    expect(result.generatedCount).toBe(0);
    expect(persona?.memory.conversationSummaries.map((summary) => summary.id)).toEqual([
      'manual-1',
      'small-old'
    ]);
    expect(usePersonaStore.getState().persistToDb).not.toHaveBeenCalled();
    expect(useRuntimeStore.getState().persistToDb).not.toHaveBeenCalled();
  });

  it('refuses to summarize while source conversation bodies are loading', async () => {
    useChatStore.setState({
      loadingMessageConversationIds: ['c1']
    });
    const requestReply = vi.fn<ConversationSummaryRequestReply>();

    await expect(updateConversationSummaryMemoryForCollaborator('aa', {
      requestReply
    })).rejects.toThrow('对话正文还在读取');

    expect(requestReply).not.toHaveBeenCalled();
    expect(useChatStore.getState().ensureFullConversationBodiesLoaded).not.toHaveBeenCalled();
  });
});
