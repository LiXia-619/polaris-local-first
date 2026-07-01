import { createUid } from './id';
import type {
  PolarisTriggerAction,
  PolarisTriggerRule,
  PolarisTriggerSchedule,
  PolarisTriggerSource,
  PolarisTriggerTarget
} from '../types/domain';

export type CreateScheduledTriggerRuleInput = {
  name?: string;
  schedule: PolarisTriggerSchedule;
  target: PolarisTriggerTarget;
  action: PolarisTriggerAction;
  source?: PolarisTriggerSource;
  now?: number;
};

type PersistedTriggerRuleInput = Omit<Partial<PolarisTriggerRule>, 'action' | 'schedule' | 'target'> & {
  action?: Partial<PolarisTriggerAction> | null;
  schedule?: Partial<PolarisTriggerSchedule> | null;
  target?: Partial<PolarisTriggerTarget> | null;
};

const DEFAULT_TRIGGER_NAME = '主动消息';
const DEFAULT_DAILY_TIME = '09:00';
const DEFAULT_INTERVAL_MINUTES = 60;

function parseDailyTime(value: string) {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function normalizeDailyTime(value: string | undefined) {
  const parsed = value ? parseDailyTime(value) : null;
  if (!parsed) return DEFAULT_DAILY_TIME;
  return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
}

function normalizeIntervalMinutes(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_INTERVAL_MINUTES;
  }
  return Math.floor(value);
}

export function normalizeTriggerSchedule(schedule?: Partial<PolarisTriggerSchedule> | null): PolarisTriggerSchedule {
  if (schedule?.kind === 'interval') {
    return {
      kind: 'interval',
      everyMinutes: normalizeIntervalMinutes(schedule.everyMinutes)
    };
  }

  return {
    kind: 'daily',
    time: normalizeDailyTime(schedule?.kind === 'daily' ? schedule.time : undefined)
  };
}

export function resolveNextTriggerRunAt(schedule: PolarisTriggerSchedule, fromMs = Date.now()) {
  if (schedule.kind === 'interval') {
    return fromMs + normalizeIntervalMinutes(schedule.everyMinutes) * 60_000;
  }

  const { hour, minute } = parseDailyTime(schedule.time) ?? parseDailyTime(DEFAULT_DAILY_TIME)!;
  for (let dayOffset = 0; ; dayOffset += 1) {
    const next = resolveLocalDailyRunDate(fromMs, dayOffset, hour, minute);
    if (next !== null && next > fromMs) {
      return next;
    }
  }
}

function resolveLocalDailyRunDate(fromMs: number, dayOffset: number, hour: number, minute: number) {
  const from = new Date(fromMs);
  const next = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + dayOffset,
    hour,
    minute,
    0,
    0
  );
  if (next.getHours() !== hour || next.getMinutes() !== minute) {
    return null;
  }
  return next.getTime();
}

function normalizeTriggerSource(source: unknown): PolarisTriggerSource {
  return source === 'webhook' || source === 'shortcut' || source === 'mcp' || source === 'manual'
    ? source
    : 'schedule';
}

function normalizeWebhookSecret(secret: unknown) {
  return typeof secret === 'string' && secret.trim()
    ? secret.trim()
    : createUid('trigger-secret');
}

function normalizeTriggerTarget(target?: Partial<PolarisTriggerTarget> | null): PolarisTriggerTarget {
  const conversationMode = target?.conversationMode === 'fixed' ? 'fixed' : 'follow-latest';
  const conversationId = target?.conversationId?.trim() || null;
  return {
    collaboratorId: target?.collaboratorId?.trim() || '',
    conversationMode,
    conversationId: conversationMode === 'fixed' ? conversationId : null
  };
}

function normalizeTriggerAction(action?: Partial<PolarisTriggerAction> | null): PolarisTriggerAction {
  return {
    prompt: action?.prompt?.trim() || ''
  };
}

export function createScheduledTriggerRule(input: CreateScheduledTriggerRuleInput): PolarisTriggerRule {
  const now = input.now ?? Date.now();
  const schedule = normalizeTriggerSchedule(input.schedule);
  return {
    id: createUid('trigger'),
    name: input.name?.trim() || DEFAULT_TRIGGER_NAME,
    enabled: true,
    source: input.source ?? 'schedule',
    webhookSecret: createUid('trigger-secret'),
    schedule,
    target: normalizeTriggerTarget(input.target),
    action: normalizeTriggerAction(input.action),
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
    nextRunAt: resolveNextTriggerRunAt(schedule, now),
    lastError: null
  };
}

export function normalizeTriggerRule(rule: PersistedTriggerRuleInput | null | undefined): PolarisTriggerRule | null {
  const target = normalizeTriggerTarget(rule?.target);
  const action = normalizeTriggerAction(rule?.action);
  if (!target.collaboratorId || !action.prompt) return null;

  const now = Date.now();
  const schedule = normalizeTriggerSchedule(rule?.schedule);
  const createdAt = typeof rule?.createdAt === 'number' ? rule.createdAt : now;
  const nextRunAt = typeof rule?.nextRunAt === 'number'
    ? rule.nextRunAt
    : resolveNextTriggerRunAt(schedule, now);

  return {
    id: rule?.id?.trim() || createUid('trigger'),
    name: rule?.name?.trim() || DEFAULT_TRIGGER_NAME,
    enabled: rule?.enabled !== false,
    source: normalizeTriggerSource(rule?.source),
    webhookSecret: normalizeWebhookSecret(rule?.webhookSecret),
    schedule,
    target,
    action,
    createdAt,
    updatedAt: typeof rule?.updatedAt === 'number' ? rule.updatedAt : createdAt,
    lastRunAt: typeof rule?.lastRunAt === 'number' ? rule.lastRunAt : null,
    nextRunAt,
    lastError: rule?.lastError?.trim() || null
  };
}

export function normalizeTriggerRules(rules?: PersistedTriggerRuleInput[] | null): PolarisTriggerRule[] {
  return (rules ?? [])
    .map((rule) => normalizeTriggerRule(rule))
    .filter((rule): rule is PolarisTriggerRule => Boolean(rule));
}

export function getDueTriggerRules(rules: PolarisTriggerRule[], now = Date.now()) {
  return rules
    .filter((rule) => rule.enabled && rule.nextRunAt !== null && rule.nextRunAt <= now)
    .sort((left, right) => (left.nextRunAt ?? 0) - (right.nextRunAt ?? 0));
}

export function advanceTriggerRuleAfterRun(rule: PolarisTriggerRule, runAt = Date.now()): PolarisTriggerRule {
  return {
    ...rule,
    lastRunAt: runAt,
    nextRunAt: resolveNextTriggerRunAt(rule.schedule, runAt),
    updatedAt: runAt,
    lastError: null
  };
}

export function markTriggerRuleError(rule: PolarisTriggerRule, error: string, now = Date.now()): PolarisTriggerRule {
  return {
    ...advanceTriggerRuleAfterRun(rule, now),
    lastError: error.trim() || '触发失败'
  };
}
