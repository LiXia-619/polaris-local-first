import { describe, expect, it } from 'vitest';
import type { PolarisTriggerRule } from '../../types/domain';
import {
  buildMenuAutomationTestPatch,
  countEnabledAutomationRules
} from './useMenuAutomationController';

function buildRule(id: string, enabled: boolean): PolarisTriggerRule {
  return {
    id,
    name: id,
    enabled,
    source: 'schedule',
    webhookSecret: 'secret',
    schedule: { kind: 'daily', time: '22:30' },
    target: { collaboratorId: 'nova', conversationMode: 'follow-latest', conversationId: null },
    action: { prompt: 'hello' },
    createdAt: 1,
    updatedAt: 1,
    lastRunAt: null,
    nextRunAt: null,
    lastError: null
  };
}

describe('menu automation controller model', () => {
  it('counts enabled automation rules for menu summaries', () => {
    expect(countEnabledAutomationRules([
      buildRule('one', true),
      buildRule('two', false),
      buildRule('three', true)
    ])).toBe(2);
  });

  it('builds the manual test patch without changing rule identity fields', () => {
    expect(buildMenuAutomationTestPatch(1234)).toEqual({
      enabled: true,
      nextRunAt: 1234
    });
  });
});
