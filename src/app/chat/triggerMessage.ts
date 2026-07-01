import { createMessage } from '../../engines/chatMessageFactory';
import type { ChatMessage, PolarisTriggerRule } from '../../types/domain';
import type { RuntimeTriggerEvent } from '../../stores/runtimeStoreTriggers';

function buildTriggerRequestContent(rule: PolarisTriggerRule, event: RuntimeTriggerEvent | null) {
  return [rule.action.prompt, event?.prompt ?? null]
    .filter((line): line is string => Boolean(line?.trim()))
    .join('\n\n');
}

function buildTriggerTimelineContent(rule: PolarisTriggerRule, event: RuntimeTriggerEvent | null) {
  const sourceLabel = event?.source === 'shortcut'
    ? '快捷指令唤醒'
    : event?.source === 'notification'
      ? '通知唤醒'
      : rule.source === 'schedule'
        ? '定时唤醒'
        : '主动唤醒';
  return `（${sourceLabel}：${rule.name}）`;
}

export function createTriggerMessage(rule: PolarisTriggerRule, event: RuntimeTriggerEvent | null): ChatMessage {
  return {
    ...createMessage('system', buildTriggerTimelineContent(rule, event), undefined, 'trigger-runtime'),
    requestRole: 'user',
    requestContent: buildTriggerRequestContent(rule, event)
  };
}
