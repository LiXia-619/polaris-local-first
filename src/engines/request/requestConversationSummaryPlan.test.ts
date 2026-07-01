import { describe, expect, it } from 'vitest';
import type { PersonaConversationSummary } from '../../types/domain';
import { resolveRequestConversationSummaryPlan } from './requestConversationSummaryPlan';

function summary(seed: Partial<PersonaConversationSummary> & Pick<PersonaConversationSummary, 'id' | 'kind' | 'content'>): PersonaConversationSummary {
  return {
    title: seed.id,
    sequence: 1,
    sourceConversationIds: ['conversation-1'],
    sourceMessageIds: ['message-1'],
    sourceCharCount: 100,
    generator: 'small_model',
    generatedAt: 10,
    updatedAt: 10,
    ...seed
  };
}

describe('resolveRequestConversationSummaryPlan', () => {
  it('keeps profile summaries before recent topics and drops expired entries', () => {
    const plan = resolveRequestConversationSummaryPlan({
      enabled: true,
      now: 100,
      maxTokens: null,
      summaries: [
        summary({
          id: 'recent-old',
          kind: 'recent_topic',
          content: '旧的最近事项。',
          updatedAt: 80,
          expiresAt: 90
        }),
        summary({
          id: 'recent-new',
          kind: 'recent_topic',
          content: '新的最近事项。',
          updatedAt: 99
        }),
        summary({
          id: 'profile',
          kind: 'relational_profile',
          content: '长期互动画像。',
          sequence: 2
        })
      ]
    });

    expect(plan.status).toBe('within_budget');
    expect(plan.selectedSummaries.map((entry) => entry.id)).toEqual(['profile', 'recent-new']);
    expect(plan.entries.find((entry) => entry.id === 'recent-old')?.status).toBe('expired');
  });

  it('preserves summary subject labels for request replay', () => {
    const plan = resolveRequestConversationSummaryPlan({
      enabled: true,
      maxTokens: null,
      summaries: [
        summary({
          id: 'profile',
          kind: 'relational_profile',
          content: '用户和 Nova 的关系画像。',
          subjectCollaboratorId: 'nova',
          subjectCollaboratorName: 'Nova',
          userLabel: '用户'
        })
      ]
    });

    expect(plan.selectedSummaries[0]).toMatchObject({
      subjectCollaboratorId: 'nova',
      subjectCollaboratorName: 'Nova',
      userLabel: '用户'
    });
  });

  it('reports disabled and budget-dropped summary entries without losing audit entries', () => {
    const disabled = resolveRequestConversationSummaryPlan({
      enabled: false,
      summaries: [summary({ id: 'profile', kind: 'relational_profile', content: '画像。' })],
      maxTokens: null
    });
    const budgeted = resolveRequestConversationSummaryPlan({
      enabled: true,
      maxTokens: 3,
      summaries: [
        summary({ id: 'profile', kind: 'relational_profile', content: '第一条会保留。' }),
        summary({ id: 'recent', kind: 'recent_topic', content: '第二条会因为预算被放下。' })
      ]
    });

    expect(disabled).toMatchObject({
      status: 'disabled',
      selectedSummaries: [],
      entries: []
    });
    expect(budgeted.status).toBe('trimmed_budget');
    expect(budgeted.selectedSummaries.map((entry) => entry.id)).toEqual(['profile']);
    expect(budgeted.entries.find((entry) => entry.id === 'recent')?.status).toBe('dropped_budget');
  });

  it('limits request-visible summaries by kind and total character budget', () => {
    const plan = resolveRequestConversationSummaryPlan({
      enabled: true,
      maxTokens: null,
      maxChars: 24,
      maxRelationalProfiles: 1,
      maxRecentTopics: 2,
      summaries: [
        summary({ id: 'profile-1', kind: 'relational_profile', content: '第一条关系画像。', sequence: 1 }),
        summary({ id: 'profile-2', kind: 'relational_profile', content: '第二条关系画像会因为条数放下。', sequence: 2 }),
        summary({ id: 'recent-1', kind: 'recent_topic', content: '最近事项一。', updatedAt: 30 }),
        summary({ id: 'recent-2', kind: 'recent_topic', content: '最近事项二。', updatedAt: 20 }),
        summary({ id: 'recent-3', kind: 'recent_topic', content: '最近事项三会因为条数放下。', updatedAt: 10 }),
        summary({ id: 'recent-huge', kind: 'recent_topic', content: '这条内容太长会因为总字数预算放下。', updatedAt: 40 })
      ]
    });

    expect(plan.status).toBe('trimmed_budget');
    expect(plan.selectedSummaries.map((entry) => entry.id)).toEqual(['profile-1', 'recent-1', 'recent-2']);
    expect(plan.entries.find((entry) => entry.id === 'profile-2')?.status).toBe('dropped_budget');
    expect(plan.entries.find((entry) => entry.id === 'recent-3')?.status).toBe('dropped_budget');
    expect(plan.entries.find((entry) => entry.id === 'recent-huge')?.status).toBe('dropped_budget');
  });
});
