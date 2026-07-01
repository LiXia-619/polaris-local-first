import { createPortal } from 'react-dom';
import { resolveCodeCardPresentation } from '../../../app/collection/codeCardPresentation';
import type { CodeChatPromptSeed } from '../../../app/collection/codeCollectionSource';
import { useI18n } from '../../../i18n';
import type { ProjectFile } from '../../../types/domain';
import { Icon } from '../../Icon';
import { runImpactAction } from '../../haptics';
import { ProjectFileCodeWorkshop } from '../workshop/ProjectFileCodeWorkshop';
import { ProjectFileTextWorkshop } from '../workshop/ProjectFileTextWorkshop';

type RoomProjectFileFullscreenProps = {
  activeProjectFile: ProjectFile;
  projectTitle: string;
  onClose: () => void;
  onUpdateProjectFile: (
    fileId: string,
    patch: Partial<Pick<ProjectFile, 'language' | 'content'>>
  ) => void;
  onDeleteProjectFile: (fileId: string) => void;
  onPromptChatCard: (card?: CodeChatPromptSeed | null) => void;
};

export function RoomProjectFileFullscreen({
  activeProjectFile,
  projectTitle,
  onClose,
  onUpdateProjectFile,
  onDeleteProjectFile,
  onPromptChatCard
}: RoomProjectFileFullscreenProps) {
  const { t } = useI18n();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="room-project-file-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label={`${projectTitle} ${activeProjectFile.filePath}`}
    >
      <div className="room-project-file-fullscreen-bar">
        <button
          type="button"
          className="room-project-fullscreen-back"
          onClick={(event) => {
            runImpactAction(onClose, { element: event.currentTarget });
          }}
          aria-label={t('collection.project.backToWorkspace')}
        >
          <Icon name="chevron" size={17} />
        </button>
        <div className="room-project-file-fullscreen-status">
          <span>{projectTitle}</span>
          <small>{t('collection.project.fileAutosaves')}</small>
        </div>
        <div className="room-project-file-fullscreen-spacer" aria-hidden="true" />
      </div>

      <div className="room-project-file-fullscreen-body">
        {resolveCodeCardPresentation({ kind: 'card', language: activeProjectFile.language }) === 'text' ? (
          <ProjectFileTextWorkshop
            activeProjectFile={activeProjectFile}
            onUpdateProjectFile={onUpdateProjectFile}
            onDeleteProjectFile={onDeleteProjectFile}
            onPromptChatCard={onPromptChatCard}
          />
        ) : (
          <ProjectFileCodeWorkshop
            activeProjectFile={activeProjectFile}
            onUpdateProjectFile={onUpdateProjectFile}
            onDeleteProjectFile={onDeleteProjectFile}
            onPromptChatCard={onPromptChatCard}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
