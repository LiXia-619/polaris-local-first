import type { ToolAction } from './toolExecutorTypes';
import type { ToolActionDescription } from './toolExecutorDescribe';

export type ProactiveMessageToolAction = Extract<
  ToolAction,
  {
    kind:
      | 'createProactiveMessageRule'
      | 'listProactiveMessageRules'
      | 'updateProactiveMessageRule'
      | 'deleteProactiveMessageRule';
  }
>;

/**
 * Natural-language descriptions for the proactive-message-rule tool actions (create / list /
 * update / delete a scheduled proactive message). Pure field formatting — no side effects and no
 * theme/CSS coupling. The central `describeToolAction` dispatcher delegates these kinds here.
 */
export function describeProactiveMessageToolAction(action: ProactiveMessageToolAction): ToolActionDescription {
  switch (action.kind) {
    case 'createProactiveMessageRule':
      return {
        kind: action.kind,
        title: '创建主动消息规则',
        summary: action.schedule.kind === 'daily'
          ? `${action.targetLabel || action.name || '当前协作者'} · 每天 ${action.schedule.time}`
          : `${action.targetLabel || action.name || '当前协作者'} · 每隔 ${action.schedule.everyMinutes} 分钟`,
        targetLabel: action.targetLabel || action.name
      };
    case 'listProactiveMessageRules':
      return {
        kind: action.kind,
        title: '查看主动消息规则',
        summary: `查看当前协作者主动消息规则${action.targetLabel ? ` · ${action.targetLabel}` : ''}`,
        targetLabel: action.targetLabel
      };
    case 'updateProactiveMessageRule':
      return {
        kind: action.kind,
        title: '修改主动消息规则',
        summary: `${action.targetLabel || action.name || action.ruleId} · 修改规则`,
        targetLabel: action.targetLabel || action.name || action.ruleId
      };
    case 'deleteProactiveMessageRule':
      return {
        kind: action.kind,
        title: '取消主动消息规则',
        summary: `${action.targetLabel || action.ruleId} · 取消规则`,
        targetLabel: action.targetLabel || action.ruleId
      };
  }
}
