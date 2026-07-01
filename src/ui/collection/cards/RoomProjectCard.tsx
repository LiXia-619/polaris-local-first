import { memo, useState } from 'react';
import { Icon } from '../../Icon';
import { useI18n } from '../../../i18n';
import { runImpactAction } from '../../haptics';
import { useTapIntentGuard } from '../useTapIntentGuard';
import type { ResolvedRoomProjectFile, RoomProjectFileSummary } from '../../../engines/roomProjects';
import type { RoomProject } from '../../../types/domain';
import { exportRoomProjectZip } from './exportRoomProjectZip';
import { ProjectCoverCard } from './ProjectCoverCard';

type RoomProjectCardProps = {
  cardsExpanded: boolean;
  project: RoomProject;
  files: RoomProjectFileSummary[];
  resolveExportFiles?: (projectId: string) => ResolvedRoomProjectFile[];
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onToggleProjectPinned: (projectId: string) => void;
};

function hasProjectFileContent(file: RoomProjectFileSummary): file is ResolvedRoomProjectFile {
  return 'content' in file && typeof file.content === 'string';
}

export const RoomProjectCard = memo(function RoomProjectCard({
  cardsExpanded,
  project,
  files,
  resolveExportFiles,
  onOpenProject,
  onDeleteProject,
  onToggleProjectPinned
}: RoomProjectCardProps) {
  const { t } = useI18n();
  const tapIntent = useTapIntentGuard();
  const [exportingZip, setExportingZip] = useState(false);

  const handleExportZip = async () => {
    if (exportingZip) return;
    try {
      setExportingZip(true);
      const exportFiles = resolveExportFiles?.(project.id) ?? files.filter(hasProjectFileContent);
      await exportRoomProjectZip(project, exportFiles);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('collection.project.exportFailed');
      window.alert(message);
    } finally {
      setExportingZip(false);
    }
  };

  return (
    <article
      className={`card room-project-card actionable-card ${cardsExpanded ? 'editing' : 'viewing'} ${project.pinnedAt ? 'pinned' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t('collection.project.openAria', { title: project.title })}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={tapIntent.handlePointerDown}
      onPointerMove={tapIntent.handlePointerMove}
      onPointerUp={tapIntent.handlePointerEnd}
      onPointerCancel={tapIntent.handlePointerEnd}
      onClick={(event) => {
        if (!tapIntent.shouldAllowTap()) return;
        runImpactAction(() => onOpenProject(project.id), { element: event.currentTarget });
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        runImpactAction(() => onOpenProject(project.id), { settle: 'none' });
      }}
    >
      {cardsExpanded ? (
        <>
          <button
            type="button"
            className="card-delete-badge"
            aria-label={t('collection.project.deleteAria', { title: project.title })}
            onClick={(event) => {
              event.stopPropagation();
              runImpactAction(() => onDeleteProject(project.id), { element: event.currentTarget });
            }}
          >
            <Icon name="x" size={10} />
          </button>
          <button
            type="button"
            className={`card-pin-badge ${project.pinnedAt ? 'active' : ''}`}
            aria-label={project.pinnedAt
              ? t('collection.project.unpinAria', { title: project.title })
              : t('collection.project.pinAria', { title: project.title })}
            onClick={(event) => {
              event.stopPropagation();
              runImpactAction(() => onToggleProjectPinned(project.id), { element: event.currentTarget });
            }}
          >
            <Icon name="pin" size={12} />
          </button>
        </>
      ) : null}
      <ProjectCoverCard project={project} files={files} />
      <button
        type="button"
        className={`code-card-run-dot room-project-card-export-dot ${exportingZip ? 'room-project-card-export-dot--busy' : ''}`.trim()}
        aria-label={exportingZip
          ? t('collection.project.exportingAria', { title: project.title })
          : t('collection.project.exportAria', { title: project.title })}
        disabled={exportingZip}
        onClick={(event) => {
          event.stopPropagation();
          runImpactAction(() => {
            void handleExportZip();
          }, { element: event.currentTarget });
        }}
      >
        <Icon name="download" size={12} />
      </button>
    </article>
  );
});
