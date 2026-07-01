import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveRoomProjectFileSummaries, resolveRoomProjectFiles } from '../../../engines/roomProjects';
import type { CodeChatPromptSeed } from '../../../app/collection/codeCollectionSource';
import type { DesktopLocalCommandResult, DesktopLocalCommandSession } from '../../../desktop/localHost';
import type { Conversation, Persona, ProjectFile, RoomProject, WorkspaceReferenceDoc } from '../../../types/domain';
import { CollectionEmptyStateWhisper } from '../grid/CollectionEmptyStateWhisper';
import { CollectionShelfLead } from '../grid/CollectionShelfLead';
import { CollectionFloatingCreateAction } from '../grid/CollectionFloatingCreateAction';
import { useI18n } from '../../../i18n';
import { RoomProjectFileFullscreen } from './RoomProjectFileFullscreen';
import { RoomProjectCard } from './RoomProjectCard';
import { RoomProjectFullscreen } from './RoomProjectFullscreen';
import { CodePreviewFullscreenLayer } from './CodePreviewFullscreenLayer';
import { ProjectDesktopTimelineRail } from './ProjectDesktopTimelineRail';

type ProjectCollectionShelfProps = {
  cardsExpanded: boolean;
  isAggregateScope: boolean;
  projectFiles: ProjectFile[];
  roomProjects: RoomProject[];
  renderProjectFullscreen?: boolean;
  activeProject: RoomProject | null;
  activeProjectFiles: ReturnType<typeof resolveRoomProjectFiles>;
  activeProjectReferenceDocs: WorkspaceReferenceDoc[];
  activeProjectConversations: Conversation[];
  activeProjectFile: ProjectFile | null;
  desktopSyncBusyProjectId: string | null;
  desktopSyncStatus: { projectId: string; message: string; tone?: 'neutral' | 'warning' } | null;
  desktopCommand: string;
  desktopCommandArgs: string;
  desktopCommandBusyProjectId: string | null;
  desktopCommandResult: { projectId: string; result: DesktopLocalCommandResult | null; error: string | null } | null;
  desktopCommandSessions: Array<DesktopLocalCommandSession & { projectId?: string }>;
  personas: Persona[];
  activeConversationId: string | null;
  previewPresentation: 'code' | 'text' | null;
  previewItemId: string | null;
  previewProjectId: string | null;
  previewProjectFileCount: number | null;
  previewTitle: string | null;
  previewLanguage: string | null;
  previewSrcDoc: string | null;
  previewContent: string;
  onOpenProject: (projectId: string) => void;
  onCreateProject: () => void;
  onCreateProjectFile: (args: {
    projectId: string;
    filePath: string;
    content?: string;
    language?: string;
    openEditor?: boolean;
  }) => string | null;
  onCreateWorkspaceReference: (args: {
    projectId: string;
    title: string;
    summary?: string;
    content?: string;
  }) => string | null;
  onImportWorkspaceReference: (args: {
    projectId: string;
    title: string;
    summary: string;
    content: string;
  }) => string | null;
  onUpdateWorkspaceReference: (
    docId: string,
    patch: Partial<Pick<WorkspaceReferenceDoc, 'title' | 'summary' | 'content'>>
  ) => void;
  onDeleteWorkspaceReference: (docId: string) => void;
  onCloseProject: () => void;
  onCloseProjectFile: () => void;
  onRenameProject: (projectId: string, title: string) => boolean;
  onToggleProjectPinned: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateProjectFile: (
    fileId: string,
    patch: Partial<Pick<ProjectFile, 'language' | 'content'>>
  ) => void;
  onDeleteProjectFile: (fileId: string) => void;
  onRunProject: (projectId: string) => void;
  onDesktopCommandChange: (value: string) => void;
  onDesktopCommandArgsChange: (value: string) => void;
  onRunDesktopProjectCommand: (projectId: string) => void;
  onStopDesktopProjectCommand: (sessionId: string) => void;
  onInspectProjectChanges: (projectId: string) => void;
  onSyncProjectFromDisk: (projectId: string) => void;
  onSyncProjectToDisk: (projectId: string) => void;
  onCreateProjectChat: (projectId: string) => void;
  onOpenProjectChat: (conversationId: string) => void;
  onDeleteProjectChat: (conversationId: string, title: string) => void;
  onOpenProjectFile: (fileId: string) => void;
  onSetProjectPreviewStateAccess: (projectId: string, assistantReadEnabled: boolean) => boolean;
  onPromptChatCard: (card?: CodeChatPromptSeed | null) => void;
  onOpenCardsShelf: () => void;
  onOpenDesktopLocalSettings: () => void;
  onClosePreview: () => void;
};

const PROJECT_CARD_ASPECT_RATIO = 196 / 390;
const PROJECT_CARD_MIN_HEIGHT = 164;
const PROJECT_GRID_GAP = 14;
const PROJECT_LIST_OVERSCAN = 6;

type ProjectListMetrics = {
  scrollTop: number;
  viewportHeight: number;
  cardHeight: number;
  gridTop: number;
};

export function ProjectCollectionShelf({
  cardsExpanded,
  isAggregateScope,
  projectFiles,
  roomProjects,
  renderProjectFullscreen = true,
  activeProject,
  activeProjectFiles,
  activeProjectReferenceDocs,
  activeProjectConversations,
  activeProjectFile,
  desktopSyncBusyProjectId,
  desktopSyncStatus,
  desktopCommand,
  desktopCommandArgs,
  desktopCommandBusyProjectId,
  desktopCommandResult,
  desktopCommandSessions,
  personas,
  activeConversationId,
  previewPresentation,
  previewItemId,
  previewProjectId,
  previewProjectFileCount,
  previewTitle,
  previewLanguage,
  previewSrcDoc,
  previewContent,
  onOpenProject,
  onCreateProject,
  onCreateProjectFile,
  onCreateWorkspaceReference,
  onImportWorkspaceReference,
  onUpdateWorkspaceReference,
  onDeleteWorkspaceReference,
  onCloseProject,
  onCloseProjectFile,
  onRenameProject,
  onToggleProjectPinned,
  onDeleteProject,
  onUpdateProjectFile,
  onDeleteProjectFile,
  onRunProject,
  onDesktopCommandChange,
  onDesktopCommandArgsChange,
  onRunDesktopProjectCommand,
  onStopDesktopProjectCommand,
  onInspectProjectChanges,
  onSyncProjectFromDisk,
  onSyncProjectToDisk,
  onCreateProjectChat,
  onOpenProjectChat,
  onDeleteProjectChat,
  onOpenProjectFile,
  onSetProjectPreviewStateAccess,
  onPromptChatCard,
  onOpenCardsShelf,
  onOpenDesktopLocalSettings,
  onClosePreview
}: ProjectCollectionShelfProps) {
  const { t, formatNumber } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [listMetrics, setListMetrics] = useState<ProjectListMetrics>({
    scrollTop: 0,
    viewportHeight: 900,
    cardHeight: 196,
    gridTop: 0
  });
  const projectFilesByProjectId = useMemo(() => {
    const buckets = new Map<string, ProjectFile[]>();
    for (const file of projectFiles) {
      const bucket = buckets.get(file.projectId);
      if (bucket) {
        bucket.push(file);
      } else {
        buckets.set(file.projectId, [file]);
      }
    }
    return buckets;
  }, [projectFiles]);
  const visibleProjects = useMemo(
    () => roomProjects.map((project) => ({
      project,
      files: resolveRoomProjectFileSummaries(project, projectFilesByProjectId.get(project.id) ?? [])
    })),
    [projectFilesByProjectId, roomProjects]
  );
  const resolveProjectExportFiles = useCallback(
    (projectId: string) => {
      const project = roomProjects.find((candidate) => candidate.id === projectId);
      if (!project) return [];
      return resolveRoomProjectFiles(project, projectFilesByProjectId.get(project.id) ?? []);
    },
    [projectFilesByProjectId, roomProjects]
  );
  const totalFileCount = useMemo(
    () => visibleProjects.reduce((sum, entry) => sum + entry.files.length, 0),
    [visibleProjects]
  );
  useEffect(() => {
    const scrollNode = scrollRef.current;
    if (!scrollNode) return;

    const measure = () => {
      const gridWidth = gridRef.current?.clientWidth || scrollNode.clientWidth;
      const scrollRect = scrollNode.getBoundingClientRect();
      const gridRect = gridRef.current?.getBoundingClientRect();
      const gridTop = gridRect ? gridRect.top - scrollRect.top + scrollNode.scrollTop : 0;
      const nextCardHeight = Math.max(PROJECT_CARD_MIN_HEIGHT, gridWidth * PROJECT_CARD_ASPECT_RATIO);
      setListMetrics((current) => {
        const next = {
          scrollTop: scrollNode.scrollTop,
          viewportHeight: scrollNode.clientHeight || current.viewportHeight,
          cardHeight: nextCardHeight,
          gridTop
        };
        if (
          Math.abs(current.scrollTop - next.scrollTop) < 1
          && Math.abs(current.viewportHeight - next.viewportHeight) < 1
          && Math.abs(current.cardHeight - next.cardHeight) < 1
          && Math.abs(current.gridTop - next.gridTop) < 1
        ) {
          return current;
        }
        return next;
      });
    };

    measure();
    scrollNode.addEventListener('scroll', measure, { passive: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(scrollNode);
    if (gridRef.current) {
      resizeObserver?.observe(gridRef.current);
    }
    return () => {
      scrollNode.removeEventListener('scroll', measure);
      resizeObserver?.disconnect();
    };
  }, [visibleProjects.length]);
  const rowHeight = listMetrics.cardHeight + PROJECT_GRID_GAP;
  const gridScrollTop = Math.max(0, listMetrics.scrollTop - listMetrics.gridTop);
  const windowStartIndex = Math.max(0, Math.floor(gridScrollTop / rowHeight) - PROJECT_LIST_OVERSCAN);
  const windowItemCount = Math.ceil(listMetrics.viewportHeight / rowHeight) + PROJECT_LIST_OVERSCAN * 2;
  const windowEndIndex = Math.min(visibleProjects.length, windowStartIndex + windowItemCount);
  const renderedProjects = visibleProjects.slice(windowStartIndex, windowEndIndex);
  const topSpacerHeight = windowStartIndex * rowHeight;
  const bottomSpacerHeight = Math.max(0, (visibleProjects.length - windowEndIndex) * rowHeight);
  const activeProjectFileProjectTitle = activeProjectFile
    ? roomProjects.find((project) => project.id === activeProjectFile.projectId)?.title ?? t('collection.project.fallbackTitle')
    : t('collection.project.fallbackTitle');
  const meta = [
    t('collection.project.shelfWorkspaceCount', { count: formatNumber(visibleProjects.length) }),
    totalFileCount > 0
      ? t('collection.project.shelfFileCount', { count: formatNumber(totalFileCount) })
      : null
  ].filter(Boolean).join(' · ');

  return (
    <section className="project-collection-shelf collection-shelf-stack collection-shelf-stack--project">
      <div className="code-collection-view-page-scroll" ref={scrollRef}>
        <CollectionShelfLead
          meta={meta}
          helpText={t('collection.project.shelfHelp')}
        />

        {visibleProjects.length > 0 ? (
          <div className="project-desktop-workbench">
            <div className="code-collection-grid-stage">
              <div className="grid code-card-grid code-card-grid--files project-card-virtual-list" ref={gridRef}>
                {topSpacerHeight > 0 ? (
                  <div
                    className="project-card-virtual-spacer"
                    style={{ height: topSpacerHeight }}
                    aria-hidden="true"
                  />
                ) : null}
                {renderedProjects.map((entry) => (
                  <RoomProjectCard
                    key={entry.project.id}
                    cardsExpanded={cardsExpanded}
                    project={entry.project}
                    files={entry.files}
                    resolveExportFiles={resolveProjectExportFiles}
                    onOpenProject={onOpenProject}
                    onDeleteProject={onDeleteProject}
                    onToggleProjectPinned={onToggleProjectPinned}
                  />
                ))}
                {bottomSpacerHeight > 0 ? (
                  <div
                    className="project-card-virtual-spacer"
                    style={{ height: bottomSpacerHeight }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </div>
            <ProjectDesktopTimelineRail
              visibleProjects={visibleProjects}
              projectFiles={projectFiles}
              fileCount={totalFileCount}
            />
          </div>
        ) : (
          <CollectionEmptyStateWhisper
            className="code-collection-filter-empty"
            title={isAggregateScope
              ? t('collection.project.emptyAggregateTitle')
              : t('collection.project.emptyRoomTitle')}
            hint={
              isAggregateScope
                ? t('collection.project.emptyAggregateHint')
                : t('collection.project.emptyRoomHint')
            }
          />
        )}
      </div>

      <CollectionFloatingCreateAction
        label={isAggregateScope
          ? t('collection.project.createDisabledAggregate')
          : t('collection.project.createWorkspace')}
        disabled={isAggregateScope}
        onPress={onCreateProject}
      />

      {renderProjectFullscreen && activeProject ? (
        <RoomProjectFullscreen
          project={activeProject}
          files={activeProjectFiles}
          referenceDocs={activeProjectReferenceDocs}
          conversations={activeProjectConversations}
          personas={personas}
          activeConversationId={activeConversationId}
          desktopLocalBusy={desktopSyncBusyProjectId === activeProject.id}
          desktopLocalStatus={desktopSyncStatus?.projectId === activeProject.id ? desktopSyncStatus.message : null}
          desktopLocalStatusTone={desktopSyncStatus?.projectId === activeProject.id ? desktopSyncStatus.tone ?? 'neutral' : 'neutral'}
          desktopCommand={desktopCommand}
          desktopCommandArgs={desktopCommandArgs}
          desktopCommandBusy={
            desktopCommandBusyProjectId === activeProject.id
            || desktopCommandSessions.some((session) => session.projectId === activeProject.id && session.status === 'running')
          }
          desktopCommandResult={desktopCommandResult?.projectId === activeProject.id ? desktopCommandResult : null}
          desktopCommandSessions={desktopCommandSessions.filter((session) => session.projectId === activeProject.id)}
          onClose={onCloseProject}
          onOpenFile={onOpenProjectFile}
          onCreateProjectFile={onCreateProjectFile}
          onCreateWorkspaceReference={onCreateWorkspaceReference}
          onImportWorkspaceReference={onImportWorkspaceReference}
          onUpdateWorkspaceReference={onUpdateWorkspaceReference}
          onDeleteWorkspaceReference={onDeleteWorkspaceReference}
          onCreateProjectChat={() => onCreateProjectChat(activeProject.id)}
          onOpenProjectChat={onOpenProjectChat}
          onDeleteProjectChat={onDeleteProjectChat}
          onRenameProject={onRenameProject}
          onSetProjectPreviewStateAccess={onSetProjectPreviewStateAccess}
          onRunProject={onRunProject}
          onDesktopCommandChange={onDesktopCommandChange}
          onDesktopCommandArgsChange={onDesktopCommandArgsChange}
          onRunDesktopProjectCommand={onRunDesktopProjectCommand}
          onStopDesktopProjectCommand={onStopDesktopProjectCommand}
          onInspectProjectChanges={onInspectProjectChanges}
          onSyncProjectFromDisk={onSyncProjectFromDisk}
          onSyncProjectToDisk={onSyncProjectToDisk}
          onOpenDesktopLocalSettings={onOpenDesktopLocalSettings}
        />
      ) : null}

      {activeProjectFile ? (
        <RoomProjectFileFullscreen
          activeProjectFile={activeProjectFile}
          projectTitle={activeProjectFileProjectTitle}
          onClose={onCloseProjectFile}
          onUpdateProjectFile={onUpdateProjectFile}
          onDeleteProjectFile={onDeleteProjectFile}
          onPromptChatCard={onPromptChatCard}
        />
      ) : null}

      <CodePreviewFullscreenLayer
        previewPresentation={previewPresentation}
        previewItemId={previewItemId}
        previewProjectId={previewProjectId}
        previewProjectFileCount={previewProjectFileCount}
        previewTitle={previewTitle}
        previewLanguage={previewLanguage}
        previewSrcDoc={previewSrcDoc}
        previewContent={previewContent}
        onClosePreview={onClosePreview}
      />
    </section>
  );
}
