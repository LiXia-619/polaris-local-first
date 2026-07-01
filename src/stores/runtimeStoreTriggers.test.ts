import { describe, expect, it, vi } from 'vitest';
import { createRuntimeTriggerEvent, createRuntimeTriggerRule, updateRuntimeTriggerRule } from './runtimeStoreTriggers';

describe('updateRuntimeTriggerRule', () => {
  it('reschedules the next run when the schedule changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T08:00:00'));

    try {
      const rule = createRuntimeTriggerRule({
        name: 'morning',
        schedule: { kind: 'daily', time: '09:00' },
        target: { collaboratorId: 'nova', conversationMode: 'follow-latest', conversationId: null },
        action: { prompt: 'wake' }
      });

      const updated = updateRuntimeTriggerRule(rule, {
        schedule: { kind: 'daily', time: '22:30' }
      });

      expect(updated?.nextRunAt).toBe(new Date('2026-04-28T22:30:00').getTime());
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createRuntimeTriggerEvent', () => {
  it('keeps dynamic shortcut text out of the persisted rule shape', () => {
    const event = createRuntimeTriggerEvent({
      ruleId: 'trigger-1',
      prompt: '  带上今天天气  ',
      source: 'shortcut'
    });

    expect(event).toEqual(expect.objectContaining({
      ruleId: 'trigger-1',
      prompt: '带上今天天气',
      source: 'shortcut'
    }));
  });
});
