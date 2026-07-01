import { describe, expect, it } from 'vitest';
import type { ChatMessage, ToolInvocation } from '../../../../types/domain';
import {
  buildVisibleToolProductCardMessageIds,
  nextToolProductCardActivationBlockedUntil,
  shouldBlockToolProductCardActivation
} from './toolProductCards';

function toolMessage(id: string, seed: Partial<ToolInvocation>): ChatMessage {
  return {
    id,
    role: 'system',
    content: seed.summary ?? '',
    timestamp: 1,
    origin: 'tool-runtime',
    toolInvocation: {
      id: `tool-${id}`,
      kind: seed.kind ?? 'patchCodeCard',
      status: seed.status ?? 'executed',
      title: seed.title ?? '已修改卡片',
      summary: seed.summary ?? '已修改卡片',
      ...seed
    }
  };
}

describe('buildVisibleToolProductCardMessageIds', () => {
  it('keeps only the latest product card per card in a tool batch', () => {
    const visibleIds = buildVisibleToolProductCardMessageIds([
      toolMessage('tool-1', { cardId: 'card-a', kind: 'patchCodeCard' }),
      toolMessage('tool-2', { cardId: 'card-a', kind: 'editCodeCardText' }),
      toolMessage('tool-3', { cardId: 'card-b', kind: 'createCodeCard' })
    ]);

    expect([...visibleIds]).toEqual(['tool-2', 'tool-3']);
  });

  it('does not render failed product cards', () => {
    const visibleIds = buildVisibleToolProductCardMessageIds([
      toolMessage('tool-1', { cardId: 'card-a', status: 'failed' }),
      toolMessage('tool-2', { cardId: 'card-a', status: 'executed' })
    ]);

    expect([...visibleIds]).toEqual(['tool-2']);
  });

  it('blocks product-card activation briefly after tool receipt interaction', () => {
    const blockedUntil = nextToolProductCardActivationBlockedUntil(1000);

    expect(shouldBlockToolProductCardActivation(blockedUntil, 1200)).toBe(true);
    expect(shouldBlockToolProductCardActivation(blockedUntil, blockedUntil)).toBe(false);
    expect(shouldBlockToolProductCardActivation(blockedUntil, 1600)).toBe(false);
  });
});
