import { describe, expect, it } from 'vitest';
import {
  advanceTriggerRuleAfterRun,
  createScheduledTriggerRule,
  getDueTriggerRules,
  normalizeTriggerRules,
  resolveNextTriggerRunAt
} from './triggers';

describe('resolveNextTriggerRunAt', () => {
  it('schedules daily triggers for today when the time has not passed', () => {
    const from = new Date('2026-04-28T08:00:00').getTime();
    const next = resolveNextTriggerRunAt({ kind: 'daily', time: '09:30' }, from);

    expect(new Date(next).toISOString()).toBe(new Date('2026-04-28T09:30:00').toISOString());
  });

  it('schedules daily triggers for tomorrow when the time has passed', () => {
    const from = new Date('2026-04-28T22:00:00').getTime();
    const next = resolveNextTriggerRunAt({ kind: 'daily', time: '09:30' }, from);

    expect(new Date(next).toISOString()).toBe(new Date('2026-04-29T09:30:00').toISOString());
  });

  it('skips nonexistent daily wall-clock times during spring DST jumps', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const from = new Date(2026, 2, 8, 1, 30, 0, 0).getTime();
      const next = new Date(resolveNextTriggerRunAt({ kind: 'daily', time: '02:30' }, from));

      expect([
        next.getFullYear(),
        next.getMonth(),
        next.getDate(),
        next.getHours(),
        next.getMinutes()
      ]).toEqual([2026, 2, 9, 2, 30]);
    } finally {
      if (previousTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimezone;
      }
    }
  });

  it('schedules interval triggers from the current run time', () => {
    expect(resolveNextTriggerRunAt({ kind: 'interval', everyMinutes: 15 }, 1000)).toBe(901000);
  });
});

describe('trigger rules', () => {
  it('creates and advances a scheduled trigger rule', () => {
    const rule = createScheduledTriggerRule({
      now: 1000,
      name: '晚安',
      schedule: { kind: 'interval', everyMinutes: 30 },
      target: { collaboratorId: 'nova', conversationMode: 'follow-latest', conversationId: null },
      action: { prompt: '主动问候我' }
    });

    expect(rule.nextRunAt).toBe(1801000);
    expect(rule.enabled).toBe(true);
    expect(rule.webhookSecret).toMatch(/^trigger-secret-/);
    expect(advanceTriggerRuleAfterRun(rule, 2000)).toEqual(expect.objectContaining({
      lastRunAt: 2000,
      nextRunAt: 1802000
    }));
  });

  it('normalizes persisted rules and filters incomplete entries', () => {
    expect(normalizeTriggerRules([
      {
        target: { collaboratorId: 'pharos', conversationId: '' },
        action: { prompt: '提醒我喝水' },
        schedule: { kind: 'daily', time: '7:05' }
      },
      {
        target: { collaboratorId: '', conversationId: null },
        action: { prompt: 'missing target' }
      }
    ])).toEqual([
      expect.objectContaining({
        target: { collaboratorId: 'pharos', conversationMode: 'follow-latest', conversationId: null },
        action: { prompt: '提醒我喝水' },
        webhookSecret: expect.stringMatching(/^trigger-secret-/),
        schedule: { kind: 'daily', time: '07:05' }
      })
    ]);
  });

  it('returns due enabled rules in run order', () => {
    const due = getDueTriggerRules([
      createScheduledTriggerRule({
        now: 0,
        name: 'later',
        schedule: { kind: 'interval', everyMinutes: 3 },
        target: { collaboratorId: 'p', conversationMode: 'follow-latest', conversationId: null },
        action: { prompt: 'later' }
      }),
      createScheduledTriggerRule({
        now: 0,
        name: 'now',
        schedule: { kind: 'interval', everyMinutes: 1 },
        target: { collaboratorId: 'p', conversationMode: 'follow-latest', conversationId: null },
        action: { prompt: 'now' }
      })
    ], 120000);

    expect(due.map((rule) => rule.name)).toEqual(['now']);
  });
});
