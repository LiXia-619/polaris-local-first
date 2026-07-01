import type { ChatMessage, ConversationTaskState } from '../../../../types/domain';
import { useI18n, type I18nTranslator } from '../../../../i18n';
import { Icon } from '../../../Icon';
import { toolIconName } from '../chatToolIcons';
import { compactToolEventSummary, toolStatusLabel } from '../chatToolLabels';

type TaskRuntimeEvidenceMessage = ChatMessage & {
  toolInvocation: NonNullable<ChatMessage['toolInvocation']>;
};

type Translate = I18nTranslator['t'];

export type TaskRuntimeExecutionSegment = {
  id: string;
  note?: string;
  messages: TaskRuntimeEvidenceMessage[];
  hasPendingWorkspaceProposal: boolean;
};

function resolveTaskStatusLabel(t: Translate, status: ConversationTaskState['status']) {
  switch (status) {
    case 'running':
      return t('chat.task.status.running');
    case 'blocked':
      return t('chat.task.status.blocked');
    case 'completed':
      return t('chat.task.status.completed');
    case 'cancelled':
      return t('chat.task.status.cancelled');
    default:
      return status;
  }
}

function resolveStepStatusLabel(t: Translate, status: ConversationTaskState['steps'][number]['status']) {
  switch (status) {
    case 'in_progress':
      return t('chat.task.stepStatus.inProgress');
    case 'blocked':
      return t('chat.task.stepStatus.blocked');
    default:
      return '';
  }
}

function resolveTaskProgress(task: ConversationTaskState) {
  if (task.steps.length === 0) return null;
  const completedCount = task.steps.filter((step) => step.status === 'completed').length;
  return {
    completedCount,
    totalCount: task.steps.length,
    percent: Math.max(6, Math.min(100, Math.round((completedCount / task.steps.length) * 100)))
  };
}

function resolveExecutionSegmentLabel(index: number) {
  return String(index + 1).padStart(2, '0');
}

export function TaskRuntimeCard({
  task,
  executionSegments,
  floating = false,
  onCollapse
}: {
  task: ConversationTaskState;
  executionSegments?: TaskRuntimeExecutionSegment[];
  floating?: boolean;
  onCollapse?: (() => void) | null;
}) {
  const { t } = useI18n();
  const progress = resolveTaskProgress(task);
  const allExecutionSegments = (executionSegments ?? []).filter(
    (segment) => segment.messages.length > 0 || segment.hasPendingWorkspaceProposal
  );
  const visibleExecutionSegments = floating ? allExecutionSegments.slice(0, 2) : allExecutionSegments;
  const visibleSteps = floating ? task.steps.slice(0, 3) : task.steps;
  const hiddenExecutionCount = allExecutionSegments.length - visibleExecutionSegments.length;
  const hiddenStepCount = task.steps.length - visibleSteps.length;

  return (
    <section className={`task-runtime-card ${task.status} ${floating ? 'floating' : 'inline'}`} aria-label={t('chat.task.currentAria')}>
      <div className="task-runtime-card-head">
        <div className="task-runtime-card-head-copy">
          <div className="task-runtime-card-title">{task.title}</div>
          <p className="task-runtime-card-stage">{task.stage}</p>
        </div>
        <div className="task-runtime-card-head-actions">
          <span className={`task-runtime-card-status ${task.status}`}>{resolveTaskStatusLabel(t, task.status)}</span>
          {onCollapse ? (
            <button
              type="button"
              className="task-runtime-card-collapse"
              aria-label={t('chat.task.collapse')}
              title={t('chat.task.collapse')}
              onClick={onCollapse}
            >
              <Icon name="chevronDown" size={14} />
            </button>
          ) : null}
        </div>
      </div>
      {task.focus || task.next ? (
        <div className="task-runtime-card-voice">
          {task.focus ? (
            <p className="task-runtime-card-voice-line focus">
              <span className="task-runtime-card-voice-kicker">{t('chat.task.now')}</span>
              <span>{task.focus}</span>
            </p>
          ) : null}
          {task.next ? (
            <p className="task-runtime-card-voice-line next">
              <span className="task-runtime-card-voice-kicker">{t('chat.task.next')}</span>
              <span>{task.next}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      {task.summary ? <p className="task-runtime-card-summary">{task.summary}</p> : null}
      {visibleSteps.length > 0 ? (
        <ol className="task-runtime-card-steps">
          {visibleSteps.map((step) => (
            <li key={step.id} className={`task-runtime-card-step ${step.status}`}>
              <span className="task-runtime-card-step-indicator" aria-hidden="true">
                <span className={`task-runtime-card-step-dot ${step.status}`} />
                <span className="task-runtime-card-step-rail" />
              </span>
              <div className="task-runtime-card-step-copy">
                <div className="task-runtime-card-step-line">
                  <span className="task-runtime-card-step-title">{step.title}</span>
                </div>
                {resolveStepStatusLabel(t, step.status) ? (
                  <div className="task-runtime-card-step-meta">{resolveStepStatusLabel(t, step.status)}</div>
                ) : null}
                {step.detail ? <p className="task-runtime-card-step-detail">{step.detail}</p> : null}
              </div>
            </li>
          ))}
          {hiddenStepCount > 0 ? (
            <li className="task-runtime-card-step task-runtime-card-step-more pending">
              <span className="task-runtime-card-step-indicator" aria-hidden="true">
                <span className="task-runtime-card-step-dot pending" />
                <span className="task-runtime-card-step-rail" />
              </span>
              <div className="task-runtime-card-step-copy">
                <div className="task-runtime-card-step-line">
                  <span className="task-runtime-card-step-title">{t('chat.task.hiddenSteps', { count: hiddenStepCount })}</span>
                </div>
              </div>
            </li>
          ) : null}
        </ol>
      ) : null}
      {visibleExecutionSegments.length > 0 ? (
        <div className="task-runtime-card-evidence">
          <div className="task-runtime-card-evidence-kicker">{t('chat.task.executionKicker')}</div>
          <div className="task-runtime-card-evidence-list">
            {visibleExecutionSegments.map((segment, index) => (
              <div key={segment.id} className="task-runtime-card-evidence-segment">
                <div className="task-runtime-card-evidence-segment-head">
                  <span className="task-runtime-card-evidence-segment-label">{resolveExecutionSegmentLabel(index)}</span>
                  {segment.note ? <span className="task-runtime-card-evidence-segment-note">{segment.note}</span> : null}
                </div>
                <div className="task-runtime-card-evidence-segment-body">
                  <span className="task-runtime-card-evidence-rail" aria-hidden="true" />
                  <div className="task-runtime-card-evidence-segment-items">
                    {segment.messages.map((message) => {
                      const tool = message.toolInvocation;
                      return (
                        <div key={message.id} className={`task-runtime-card-evidence-item ${tool.status}`}>
                          <span className={`task-runtime-card-evidence-icon ${tool.status}`} aria-hidden="true">
                            <Icon name={toolIconName(tool)} size={12} />
                          </span>
                          <div className="task-runtime-card-evidence-copy">
                            <div className="task-runtime-card-evidence-line">
                              <span className="task-runtime-card-evidence-title">{tool.title}</span>
                              <span className={`task-runtime-card-evidence-status ${tool.status}`}>{toolStatusLabel(tool.status, t)}</span>
                            </div>
                            <p className="task-runtime-card-evidence-summary">{compactToolEventSummary(tool, t)}</p>
                          </div>
                        </div>
                      );
                    })}
                    {segment.hasPendingWorkspaceProposal ? (
                      <div className="task-runtime-card-evidence-item pending">
                        <span className="task-runtime-card-evidence-icon pending" aria-hidden="true">
                          <Icon name="folder" size={12} />
                        </span>
                        <div className="task-runtime-card-evidence-copy">
                          <div className="task-runtime-card-evidence-line">
                            <span className="task-runtime-card-evidence-title">{t('chat.task.workspacePendingTitle')}</span>
                            <span className="task-runtime-card-evidence-status pending">{t('chat.task.workspacePendingStatus')}</span>
                          </div>
                          <p className="task-runtime-card-evidence-summary">{t('chat.task.workspacePendingSummary')}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hiddenExecutionCount > 0 ? (
            <p className="task-runtime-card-more">{t('chat.task.hiddenExecutions', { count: hiddenExecutionCount })}</p>
          ) : null}
        </div>
      ) : null}
      {progress ? (
        <div className="task-runtime-card-progress" aria-label={t('chat.task.progressAria', { completed: progress.completedCount, total: progress.totalCount })}>
          <div className="task-runtime-card-progress-copy">
            <span>{t('chat.task.progressText', { completed: progress.completedCount, total: progress.totalCount })}</span>
          </div>
          <div className="task-runtime-card-progress-track" aria-hidden="true">
            <span className="task-runtime-card-progress-fill" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
