import { describe, expect, it } from 'vitest';
import {
  resolveRequestSemanticRecallPlan,
  resolveSemanticRecallConfig,
  resolveSemanticRecallContextCandidates
} from './requestSemanticRecallPlan';
import type { ChatMessage, Conversation } from '../../types/domain';

function message(id: string, content: string, timestamp: number): ChatMessage {
  return {
    id,
    role: 'user',
    content,
    timestamp
  };
}

function assistantMessage(id: string, content: string, timestamp: number): ChatMessage {
  return {
    id,
    role: 'assistant',
    content,
    timestamp
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

describe('resolveRequestSemanticRecallPlan', () => {
  it('returns not_configured until a local conversation corpus is provided', () => {
    expect(resolveRequestSemanticRecallPlan()).toMatchObject({
      status: 'not_configured',
      strategy: 'none',
      selectedCandidates: []
    });
  });

  it('stays disabled when the collaborator turns cross-conversation recall off', () => {
    const plan = resolveRequestSemanticRecallPlan({
      enabled: false,
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', '记忆系统要有清楚地基和候选召回', 10)],
      conversations: [
        conversation({
          id: 'older-match',
          title: '记忆讨论',
          messages: [message('old-user', '之前说过记忆地基要清楚，召回只能当候选。', 1)]
        })
      ]
    });

    expect(plan).toMatchObject({
      status: 'disabled',
      strategy: 'none',
      selectedCandidates: [],
      entries: []
    });
  });

  it('selects recent conversation tails even without query terms', () => {
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', '', 10)],
      conversations: [
        conversation({
          id: 'recent-one',
          title: '刚才的窗口',
          messages: [message('recent-user-1', '刚才最后在聊主题和记忆的边界。', 30)]
        }),
        conversation({
          id: 'recent-two',
          title: '再早一点',
          messages: [message('recent-user-2', '还有一个窗口最后停在长期资料目录。', 20)]
        })
      ]
    });

    expect(plan.status).toBe('within_budget');
    expect(plan.config).toEqual({
      recentTailConversationCount: 3,
      recentTailUserMessageCount: 3,
      voiceAnchorCount: 3
    });
    expect(plan.selectedCandidates.map((candidate) => candidate.kind)).toEqual([
      'recent_tail',
      'recent_tail'
    ]);
    expect(JSON.stringify(plan)).not.toContain('刚才最后在聊主题');
  });

  it('selects matching older conversation candidates without storing raw text', () => {
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', '记忆系统要有清楚地基和候选召回', 10)],
      conversations: [
        conversation({
          id: 'active',
          title: '当前对话',
          messages: [message('current-user', '记忆系统要有清楚地基和候选召回', 10)]
        }),
        conversation({
          id: 'older-match',
          title: '记忆讨论',
          updatedAt: 1,
          messages: [message('old-user', '记忆地基候选', 1)]
        }),
        conversation({
          id: 'recent-a',
          title: '最近 A',
          updatedAt: 30,
          messages: [message('recent-a-user', '这里是一段更长的最近窗口结尾，用来占住 recent tail 和 voice anchor 的名额。', 30)]
        }),
        conversation({
          id: 'recent-b',
          title: '最近 B',
          updatedAt: 20,
          messages: [message('recent-b-user', '这里是另一段更长的最近窗口结尾，用来模拟旧窗口最后的原话。', 20)]
        }),
        conversation({
          id: 'recent-c',
          title: '最近 C',
          updatedAt: 10,
          messages: [message('recent-c-user', '这里是第三段更长的最近窗口结尾，和当前记忆主题没有关系。', 10)]
        })
      ]
    });

    expect(plan.status).toBe('within_budget');
    expect(plan.strategy).toBe('local_scan');
    expect(plan.selectedCandidates).toContainEqual(expect.objectContaining({
      id: 'recall:matched_context:older-match:old-user',
      kind: 'matched_context',
      label: '记忆讨论',
      sourceConversationId: 'older-match',
      sourceMessageIds: ['old-user'],
      status: 'kept',
      score: expect.any(Number),
      contentFingerprint: expect.any(String)
    }));
    expect(JSON.stringify(plan)).not.toContain('记忆地基候选');
  });

  it('does not select text-similar candidates from pronoun-only overlap', () => {
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      config: {
        recentTailConversationCount: 1,
        voiceAnchorCount: 0
      },
      messages: [message('current-user', '我你他的这个那个', 10)],
      conversations: [
        conversation({
          id: 'older-pronouns',
          title: '代词旧话',
          updatedAt: 1,
          messages: [message('old-user', '你我他的这个那个', 1)]
        }),
        conversation({
          id: 'recent-tail',
          title: '最近尾巴',
          updatedAt: 30,
          messages: [message('recent-user', '最近还在聊一个真实主题。', 30)]
        })
      ]
    });

    expect(plan.selectedCandidates.some((candidate) => candidate.kind === 'matched_context')).toBe(false);
  });

  it('prioritizes preset object anchors over generic text overlap', () => {
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      config: {
        recentTailConversationCount: 1,
        voiceAnchorCount: 0
      },
      messages: [message('current-user', 'Claude 刚才那个模型选择怎么处理', 100)],
      conversations: [
        conversation({
          id: 'recent-filler',
          title: '最近尾巴',
          updatedAt: 100,
          messages: [message('recent-filler-user', '这是最近尾巴，不参与锚点排序。', 100)]
        }),
        conversation({
          id: 'claude',
          title: 'Claude 讨论',
          updatedAt: 1,
          messages: [message('claude-user', 'Claude 的上下文召回要保留模型名称。', 1)]
        }),
        conversation({
          id: 'generic',
          title: '普通模型讨论',
          updatedAt: 50,
          messages: [message('generic-user', '模型选择怎么处理，刚才还在说这个。', 50)]
        })
      ]
    });

    expect(plan.selectedCandidates.find((candidate) => candidate.kind === 'matched_context')).toEqual(
      expect.objectContaining({
        id: 'recall:matched_context:claude:claude-user',
        score: expect.any(Number)
      })
    );
  });

  it('uses repeated corpus terms as grown anchors for local recall', () => {
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      config: {
        recentTailConversationCount: 1,
        voiceAnchorCount: 0
      },
      messages: [message('current-user', '小饼干那条记忆怎么整理', 100)],
      conversations: [
        conversation({
          id: 'recent-filler',
          title: '最近尾巴',
          updatedAt: 100,
          messages: [message('recent-filler-user', '这是最近尾巴，不参与锚点排序。', 100)]
        }),
        conversation({
          id: 'snack-a',
          title: '小饼干 A',
          updatedAt: 1,
          messages: [message('snack-a-user', '小饼干第一次被当成代号。', 1)]
        }),
        conversation({
          id: 'snack-b',
          title: '小饼干 B',
          updatedAt: 2,
          messages: [message('snack-b-user', '小饼干后来又和记忆整理放在一起。', 2)]
        })
      ]
    });

    expect(plan.selectedCandidates.filter((candidate) => candidate.kind === 'matched_context').map((candidate) => candidate.id)).toEqual([
      'recall:matched_context:snack-b:snack-b-user',
      'recall:matched_context:snack-a:snack-a-user'
    ]);
    expect(plan.selectedCandidates.find((candidate) => candidate.id === 'recall:matched_context:snack-b:snack-b-user')?.score ?? 0).toBeGreaterThan(4);
  });

  it('adds medium natural user wording as a voice anchor without duplicating recent tails', () => {
    const mediumVoice = '我真正想要的不是机械摘要，而是让模型从我说话的长度、转折、担心和反复绕回来的地方，重新认出这是同一个人在说话。';
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', '继续', 100)],
      conversations: [
        conversation({
          id: 'recent-a',
          title: '最近 A',
          updatedAt: 30,
          messages: [message('recent-a-user', '刚才聊到这里。', 30)]
        }),
        conversation({
          id: 'recent-b',
          title: '最近 B',
          updatedAt: 20,
          messages: [message('recent-b-user', '再早一点停在这里。', 20)]
        }),
        conversation({
          id: 'recent-c',
          title: '最近 C',
          updatedAt: 10,
          messages: [message('recent-c-user', '第三个窗口。', 10)]
        }),
        conversation({
          id: 'old-long',
          title: '自然原话',
          updatedAt: 1,
          messages: [message('old-long-user', mediumVoice, 1)]
        })
      ]
    });

    expect(plan.selectedCandidates).toContainEqual(expect.objectContaining({
      id: 'recall:voice_anchor:old-long:old-long-user',
      kind: 'voice_anchor',
      sourceConversationId: 'old-long',
      sourceMessageIds: ['old-long-user']
    }));
    expect(JSON.stringify(plan)).not.toContain(mediumVoice);
  });

  it('merges vector recall candidates into the same original-text context lane', () => {
    const vectorSource = conversation({
      id: 'semantic-old',
      title: '语义旧窗口',
      updatedAt: 1,
      messages: [message('semantic-user', '当时聊的是向量索引不能卡住前台对话。', 1)]
    });
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', 'background retrieval pipeline', 10)],
      conversations: [
        conversation({
          id: 'recent-tail',
          title: '最近窗口',
          updatedAt: 20,
          messages: [message('recent-tail-user', '最近停在这里。', 20)]
        }),
        vectorSource
      ],
      config: {
        recentTailConversationCount: 1,
        voiceAnchorCount: 1
      },
      vectorCandidates: [{
        id: 'recall:vector_match:semantic-old:chunk-1',
        kind: 'vector_match',
        label: '语义旧窗口',
        sourceConversationId: 'semantic-old',
        sourceMessageIds: ['semantic-user'],
        estimatedTokens: 20,
        charCount: 30,
        score: 0.91,
        contentFingerprint: 'fingerprint-vector',
        status: 'kept'
      }]
    });

    expect(plan.strategy).toBe('semantic_index');
    expect(plan.selectedCandidates).toContainEqual(expect.objectContaining({
      id: 'recall:vector_match:semantic-old:chunk-1',
      kind: 'vector_match',
      score: 0.91
    }));
    expect(JSON.stringify(plan)).not.toContain('不能卡住前台');
    expect(resolveSemanticRecallContextCandidates({
      plan,
      conversations: [vectorSource]
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'vector_match',
        text: '当时聊的是向量索引不能卡住前台对话。'
      })
    ]));
  });

  it('keeps recall scoped to the current collaborator', () => {
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', '供应商抽象层和记忆地基', 10)],
      conversations: [
        conversation({
          id: 'other-persona',
          title: '另一个协作者',
          collaboratorId: 'other',
          messages: [message('other-user', '供应商抽象层和记忆地基都提过。', 1)]
        })
      ]
    });

    expect(plan).toMatchObject({
      status: 'empty',
      strategy: 'local_scan',
      selectedCandidates: []
    });
  });

  it('marks extra candidates as dropped when an explicit budget is provided', () => {
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: 1,
      messages: [message('current-user', 'memory candidate recall boundary', 10)],
      conversations: [
        conversation({
          id: 'first',
          title: 'first',
          messages: [message('first-user', 'memory candidate recall boundary first older note', 1)]
        }),
        conversation({
          id: 'second',
          title: 'second',
          messages: [message('second-user', 'memory candidate recall boundary second older note', 2)]
        })
      ]
    });

    expect(plan.selectedCandidates).toHaveLength(1);
    expect(plan.entries.some((entry) => entry.status === 'dropped_budget')).toBe(true);
    expect(plan.status).toBe('trimmed_budget');
  });

  it('resolves recent tail text with recent user phrasing and only the final assistant reply', () => {
    const older = conversation({
      id: 'older-match',
      title: '记忆讨论',
      messages: [
        message('old-user-1', '第一句用户原话已经离尾巴太远。', 1),
        assistantMessage('old-assistant-1', '这一条中间助手回复不应该进 recent tail。', 2),
        message('old-user-2', '第二句用户原话要保留。', 3),
        message('old-user-3', '第三句用户原话也要保留。', 4),
        message('old-user-4', '旧对话片段只应该在 context 组装时临时取出。', 5),
        assistantMessage('old-assistant-2', '这条助手回复会被最后一条覆盖。', 6),
        assistantMessage('old-assistant-3', '助手当时已经接住了这个边界。', 7)
      ]
    });
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', '旧对话 context 组装', 10)],
      conversations: [older]
    });

    expect(JSON.stringify(plan)).not.toContain('第二句用户原话');
    expect(JSON.stringify(plan)).not.toContain('助手当时已经接住');

    expect(resolveSemanticRecallContextCandidates({
      plan,
      conversations: [older]
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'recall:recent_tail:older-match:old-user-2+old-user-3+old-user-4+old-assistant-3',
        kind: 'recent_tail',
        sourceTimestamp: 7,
        text: [
          'user: 第二句用户原话要保留。',
          'user: 第三句用户原话也要保留。',
          'user: 旧对话片段只应该在 context 组装时临时取出。',
          'assistant: 助手当时已经接住了这个边界。'
        ].join('\n\n')
      })
    ]));
    expect(resolveSemanticRecallContextCandidates({
      plan,
      conversations: [older]
    })).not.toContainEqual(expect.objectContaining({
      sourceMessageIds: expect.arrayContaining(['old-assistant-1'])
    }));
    expect(resolveSemanticRecallContextCandidates({
      plan,
      conversations: [older]
    })).not.toContainEqual(expect.objectContaining({
      sourceMessageIds: expect.arrayContaining(['old-assistant-2'])
    }));
  });

  it('keeps generated continuation prompts out of recent tail text', () => {
    const older = conversation({
      id: 'older-match',
      title: '续接窗口',
      messages: [
        message('old-user-1', '真正的旧窗口尾巴。', 1),
        {
          ...message(
            'length-followup',
            [
              '上一条回答在中途停住了，可能是输出长度到顶，也可能是流式连接提前结束。',
              '不要重头开始，不要道歉，不要复述前文。',
              '直接从刚才断开的那一句继续，但只接下一小段。'
            ].join(' '),
            2
          ),
          origin: 'system-note' as const
        },
        assistantMessage('old-assistant-1', '助手接住了真正的旧窗口尾巴。', 3)
      ]
    });
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', '继续', 10)],
      conversations: [older]
    });

    expect(resolveSemanticRecallContextCandidates({
      plan,
      conversations: [older]
    })).toEqual([
      expect.objectContaining({
        id: 'recall:recent_tail:older-match:old-user-1+old-assistant-1',
        kind: 'recent_tail',
        text: [
          'user: 真正的旧窗口尾巴。',
          'assistant: 助手接住了真正的旧窗口尾巴。'
        ].join('\n\n')
      })
    ]);
  });

  it('uses collaborator recall config to choose tail thickness', () => {
    const older = conversation({
      id: 'older-match',
      title: '记忆讨论',
      messages: [
        message('old-user-1', '第一句用户原话不该被这档厚度带上。', 1),
        message('old-user-2', '第二句用户原话要保留。', 2),
        message('old-user-3', '第三句用户原话也要保留。', 3),
        assistantMessage('old-assistant-1', '最后的助手回复一起作为片段尾巴。', 4)
      ]
    });
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', '继续', 10)],
      conversations: [older],
      config: {
        recentTailUserMessageCount: 2
      }
    });

    expect(resolveSemanticRecallContextCandidates({
      plan,
      conversations: [older]
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'recall:recent_tail:older-match:old-user-2+old-user-3+old-assistant-1',
        kind: 'recent_tail',
        text: [
          'user: 第二句用户原话要保留。',
          'user: 第三句用户原话也要保留。',
          'assistant: 最后的助手回复一起作为片段尾巴。'
        ].join('\n\n')
      })
    ]));
    expect(plan.config.recentTailUserMessageCount).toBe(2);
  });

  it('uses collaborator recall config to choose natural medium voice anchors', () => {
    const pastedText = [
      '```json',
      '{"candidateId":"abc","messageIds":["m1"],"score":0.91}',
      '```'
    ].join('\n');
    const mediumVoice = '我其实不想让它背一整段粘贴材料，我只是想让它记住我平时会这样绕一下、停一下，然后把真正担心的地方补出来。';
    const plan = resolveRequestSemanticRecallPlan({
      activeConversationId: 'active',
      currentCollaboratorId: 'pharos',
      maxTokens: null,
      messages: [message('current-user', '继续', 100)],
      conversations: [
        conversation({
          id: 'recent-tail',
          title: '最近窗口',
          updatedAt: 30,
          messages: [message('recent-tail-user', '最近停在这里。', 30)]
        }),
        conversation({
          id: 'long-a',
          title: '粘贴原文',
          updatedAt: 2,
          messages: [message('long-a-user', pastedText, 2)]
        }),
        conversation({
          id: 'medium',
          title: '自然语气',
          updatedAt: 1,
          messages: [message('medium-user', mediumVoice, 1)]
        })
      ],
      config: {
        recentTailConversationCount: 1,
        voiceAnchorCount: 1
      }
    });

    expect(plan.selectedCandidates.filter((candidate) => candidate.kind === 'voice_anchor')).toEqual([
      expect.objectContaining({
        id: 'recall:voice_anchor:medium:medium-user',
        kind: 'voice_anchor'
      })
    ]);
    expect(JSON.stringify(plan)).not.toContain('candidateId');
  });

  it('falls back to the default recall config for invalid persisted counts', () => {
    expect(resolveSemanticRecallConfig({
      recentTailConversationCount: 0,
      recentTailUserMessageCount: Number.NaN,
      voiceAnchorCount: 2.8
    })).toEqual({
      recentTailConversationCount: 3,
      recentTailUserMessageCount: 3,
      voiceAnchorCount: 2
    });
  });
});
