import { useMemo } from 'react';
import { resolveRoomProjectFileSummaries } from '../../../engines/roomProjects';
import type { ProjectFile, RoomProject } from '../../../types/domain';
import { Icon } from '../../Icon';
import { useI18n, type I18nTranslator } from '../../../i18n';

type ProjectDesktopRailItem = {
  id: string;
  kind: 'project' | 'file' | 'desktop';
  title: string;
  detail: string;
  at: number;
};

type ProjectDesktopActivityDay = {
  id: string;
  label: string;
  count: number;
  level: number;
};

type ProjectDesktopTimelineRailProps = {
  visibleProjects: Array<{ project: RoomProject; files: ReturnType<typeof resolveRoomProjectFileSummaries> }>;
  projectFiles: ProjectFile[];
  fileCount: number;
};

const DESKTOP_ACTIVITY_DAY_COUNT = 42;

function startOfLocalDay(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDesktopRailTime(value: number, language: I18nTranslator['language']) {
  return new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatDesktopActivityDayLabel(value: number, language: I18nTranslator['language']) {
  return new Intl.DateTimeFormat(language, {
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

function buildDesktopRailItems(
  args: Pick<ProjectDesktopTimelineRailProps, 'visibleProjects' | 'projectFiles'>,
  t: I18nTranslator['t']
) {
  const projectTitleById = new Map(args.visibleProjects.map((entry) => [entry.project.id, entry.project.title] as const));
  const projectItems: ProjectDesktopRailItem[] = args.visibleProjects.map((entry) => ({
    id: `project:${entry.project.id}`,
    kind: entry.project.desktopBinding ? 'desktop' : 'project',
    title: entry.project.title,
    detail: entry.project.desktopBinding
      ? t('settings.desktopLocal.timelineBoundDetail', { root: entry.project.desktopBinding.rootLabel })
      : t('settings.desktopLocal.timelineFileCount', { count: entry.files.length }),
    at: entry.project.desktopBinding?.syncedAt ?? entry.project.updatedAt
  }));
  const fileItems: ProjectDesktopRailItem[] = args.projectFiles.flatMap((file) => {
    const title = projectTitleById.get(file.projectId);
    if (!title) return [];
    return [{
      id: `file:${file.id}`,
      kind: 'file' as const,
      title: file.filePath,
      detail: title,
      at: file.updatedAt
    }];
  });

  return [...projectItems, ...fileItems]
    .sort((left, right) => right.at - left.at)
    .slice(0, 7);
}

function buildDesktopActivityDays(
  args: Pick<ProjectDesktopTimelineRailProps, 'visibleProjects' | 'projectFiles'>,
  language: I18nTranslator['language']
) {
  const countsByDay = new Map<number, number>();
  const addActivity = (value: number | null | undefined) => {
    if (!value) return;
    const day = startOfLocalDay(value);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  };

  for (const entry of args.visibleProjects) {
    addActivity(entry.project.updatedAt);
    addActivity(entry.project.desktopBinding?.syncedAt);
  }
  for (const file of args.projectFiles) {
    addActivity(file.updatedAt);
  }

  const today = startOfLocalDay(Date.now());
  const maxCount = Math.max(1, ...Array.from(countsByDay.values()));

  return Array.from({ length: DESKTOP_ACTIVITY_DAY_COUNT }, (_, index): ProjectDesktopActivityDay => {
    const day = today - (DESKTOP_ACTIVITY_DAY_COUNT - 1 - index) * 24 * 60 * 60 * 1000;
    const count = countsByDay.get(day) ?? 0;
    return {
      id: String(day),
      label: formatDesktopActivityDayLabel(day, language),
      count,
      level: count === 0 ? 0 : Math.max(1, Math.ceil((count / maxCount) * 4))
    };
  });
}

export function ProjectDesktopTimelineRail({
  visibleProjects,
  projectFiles,
  fileCount
}: ProjectDesktopTimelineRailProps) {
  const { t, language } = useI18n();
  const items = useMemo(
    () => buildDesktopRailItems({ visibleProjects, projectFiles }, t),
    [visibleProjects, projectFiles, t]
  );
  const boundProjectCount = useMemo(
    () => visibleProjects.filter((entry) => entry.project.desktopBinding).length,
    [visibleProjects]
  );
  const activityDays = useMemo(
    () => buildDesktopActivityDays({ visibleProjects, projectFiles }, language),
    [language, visibleProjects, projectFiles]
  );
  const activeDayCount = useMemo(
    () => activityDays.filter((day) => day.count > 0).length,
    [activityDays]
  );

  return (
    <aside className="project-desktop-timeline-rail" aria-label={t('settings.desktopLocal.timelineAria')}>
      <section className="project-desktop-rail-section project-desktop-rail-section--activity">
        <div className="project-desktop-rail-head">
          <span>{t('settings.desktopLocal.activityCalendar')}</span>
          <small>{t('settings.desktopLocal.activeDayCount', { count: activeDayCount })}</small>
        </div>
        <div
          className="project-desktop-activity-grid"
          aria-label={t('settings.desktopLocal.activityGridAria', { count: DESKTOP_ACTIVITY_DAY_COUNT })}
        >
          {activityDays.map((day) => (
            <span
              key={day.id}
              className={`project-desktop-activity-cell level-${day.level}`}
              title={t('settings.desktopLocal.activityCellTitle', { day: day.label, count: day.count })}
              aria-label={t('settings.desktopLocal.activityCellAria', { day: day.label, count: day.count })}
            />
          ))}
        </div>
      </section>

      <section className="project-desktop-rail-section project-desktop-rail-section--status">
        <div className="project-desktop-rail-head">
          <span>{t('settings.desktopLocal.desktopStatus')}</span>
          <Icon name="compass" size={14} />
        </div>
        <div className="project-desktop-status-grid">
          <span>
            <strong>{boundProjectCount}</strong>
            <small>{t('settings.desktopLocal.boundLocal')}</small>
          </span>
          <span>
            <strong>{fileCount}</strong>
            <small>{t('settings.desktopLocal.fileProjection')}</small>
          </span>
        </div>
      </section>

      <section className="project-desktop-rail-section">
        <div className="project-desktop-rail-head">
          <span>{t('settings.desktopLocal.recentActivity')}</span>
          <Icon name="fileText" size={14} />
        </div>
        <div className="project-desktop-timeline-list">
          {items.length > 0 ? items.map((item) => (
            <div key={item.id} className={`project-desktop-timeline-item project-desktop-timeline-item--${item.kind}`}>
              <span className="project-desktop-timeline-dot" aria-hidden="true" />
              <div>
                <strong>{item.title}</strong>
                <small>{item.detail} · {formatDesktopRailTime(item.at, language)}</small>
              </div>
            </div>
          )) : (
            <p className="project-desktop-rail-empty">{t('settings.desktopLocal.waitingFirstChange')}</p>
          )}
        </div>
      </section>

      <section className="project-desktop-rail-section project-desktop-rail-section--memo">
        <div className="project-desktop-rail-head">
          <span>{t('settings.desktopLocal.memoBoard')}</span>
          <Icon name="feather" size={14} />
        </div>
        <p>{t('settings.desktopLocal.noDesktopMemo')}</p>
      </section>
    </aside>
  );
}
