import type { ToolAction } from './toolExecutorTypes';
import type { ToolActionDescription } from './toolExecutorDescribe';

export type TaskToolAction = Extract<ToolAction, { kind: 'startTask' | 'completeTask' | 'wait' }>;

/**
 * Natural-language descriptions for the task-flow tool actions (start / complete a task, wait
 * before polling). Pure field formatting — no side effects and no theme/CSS coupling. The central
 * `describeToolAction` dispatcher delegates these kinds here.
 */
export function describeTaskToolAction(action: TaskToolAction): ToolActionDescription {
  switch (action.kind) {
    case 'startTask':
      return {
        kind: action.kind,
        title: '开启任务',
        summary: action.title || action.targetLabel || (action.capability ? `进入 ${action.capability} 工作流` : '当前请求进入连续任务'),
        targetLabel: action.targetLabel || action.title
      };
    case 'completeTask':
      return {
        kind: action.kind,
        title: '完成任务',
        summary: action.summary || action.stage || action.targetLabel || '当前任务已完成',
        targetLabel: action.targetLabel || action.stage
      };
    case 'wait': {
      const seconds = action.seconds && Number.isFinite(action.seconds) && action.seconds > 0 ? action.seconds : 3;
      const formattedSeconds = Number.isInteger(seconds)
        ? String(seconds)
        : seconds.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
      return {
        kind: action.kind,
        title: '等待轮询',
        summary: `${action.targetLabel || action.reason || '继续前等待'} · ${formattedSeconds} 秒`,
        targetLabel: action.targetLabel || action.reason
      };
    }
  }
}
