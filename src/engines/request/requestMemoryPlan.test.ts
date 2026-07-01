import { describe, expect, it } from 'vitest';
import { resolveRequestMemoryPlan } from './requestMemoryPlan';
import type { PersonaMemorySettings } from '../../types/domain';

function createMemory(overrides: Partial<PersonaMemorySettings> = {}): PersonaMemorySettings {
  return {
    inheritGlobal: true,
    crossConversationRecallEnabled: true,
    excludeFromGlobal: false,
    excludedGlobalIds: [],
    personalMemories: [],
    conversationSummaries: [],
    referenceDocs: [],
    ...overrides
  };
}

describe('resolveRequestMemoryPlan', () => {
  it('inherits memories saved by other collaborators when global memory is enabled', () => {
    const plan = resolveRequestMemoryPlan({
      memory: createMemory({
        personalMemories: ['用户 喜欢清楚边界。']
      }),
      inheritedMemorySources: [
        {
          id: 'nova',
          memory: createMemory({
            personalMemories: ['用户 偏好柔和但明确的解释。']
          })
        }
      ],
      maxTokens: null
    });

    expect(plan.selectedLines).toContain('用户 喜欢清楚边界。');
    expect(plan.selectedLines).toContain('用户 偏好柔和但明确的解释。');
  });

  it('respects disabled global inheritance and excluded collaborators', () => {
    const withoutGlobal = resolveRequestMemoryPlan({
      memory: createMemory({
        inheritGlobal: false,
        personalMemories: ['只读当前协作者。']
      }),
      inheritedMemorySources: [
        {
          id: 'nova',
          memory: createMemory({
            personalMemories: ['不应该被继承。']
          })
        }
      ],
      maxTokens: null
    });

    expect(withoutGlobal.selectedLines).toEqual(['只读当前协作者。']);

    const withExcludedSource = resolveRequestMemoryPlan({
      memory: createMemory({
        excludedGlobalIds: ['nova'],
        personalMemories: ['当前协作者记忆。']
      }),
      inheritedMemorySources: [
        {
          id: 'nova',
          memory: createMemory({
            personalMemories: ['被排除的协作者记忆。']
          })
        },
        {
          id: 'mimo',
          memory: createMemory({
            personalMemories: ['未排除的协作者记忆。']
          })
        }
      ],
      maxTokens: null
    });

    expect(withExcludedSource.selectedLines).toContain('当前协作者记忆。');
    expect(withExcludedSource.selectedLines).toContain('未排除的协作者记忆。');
    expect(withExcludedSource.selectedLines).not.toContain('被排除的协作者记忆。');
  });

  it('does not inherit memories from collaborators excluded from global memory', () => {
    const plan = resolveRequestMemoryPlan({
      memory: createMemory({
        personalMemories: ['当前协作者记忆。']
      }),
      inheritedMemorySources: [
        {
          id: 'private',
          memory: createMemory({
            excludeFromGlobal: true,
            personalMemories: ['不进入全局的协作者记忆。']
          })
        },
        {
          id: 'shared',
          memory: createMemory({
            personalMemories: ['允许进入全局的协作者记忆。']
          })
        }
      ],
      maxTokens: null
    });

    expect(plan.selectedLines).toContain('当前协作者记忆。');
    expect(plan.selectedLines).toContain('允许进入全局的协作者记忆。');
    expect(plan.selectedLines).not.toContain('不进入全局的协作者记忆。');
  });
});
