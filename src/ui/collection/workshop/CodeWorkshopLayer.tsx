import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { COLLECTION_FRONTSTAGE_SURFACES } from '../../frontstage/frontstageSurfaceRegistry';
import type { CodeCardSourceContext, CodeChatPromptSeed } from '../../../app/collection/codeCollectionSource';
import { resolveCodeCardPresentation } from '../../../app/collection/codeCardPresentation';
import type { CodeCard, ProjectFile } from '../../../types/domain';
import { Icon } from '../../Icon';
import { runImpactAction } from '../../haptics';
import { CodeWorkshop } from './CodeWorkshop';
import { CodeWorkshopEmptyState } from './CodeWorkshopEmptyState';
import { CreateCodeWorkshopFullscreen } from './CreateCodeWorkshopFullscreen';
import { ProjectFileCodeWorkshop } from './ProjectFileCodeWorkshop';
import { ProjectFileTextWorkshop } from './ProjectFileTextWorkshop';
import { TextReadingWorkshop } from './TextReadingWorkshop';
import { useI18n } from '../../../i18n';

export type CodeWorkshopMode = 'create' | 'edit';

type CodeWorkshopLayerProps = {
  mode: CodeWorkshopMode | null;
  roomTags: string[];
  activeRoomTag: string | null;
  activeCard: CodeCard | null;
  activeProjectFile: ProjectFile | null;
  activeCardOriginLabel: string | null;
  activeCardSourceContext: CodeCardSourceContext | null;
  onClose: () => void;
  onOpenCreate: () => void;
  onSaveCard: (seed: Partial<CodeCard>, editingCardId?: string | null) => { cardId: string; created: boolean };
  onUpdateCard: (cardId: string, patch: Partial<CodeCard>) => void;
  onUpdateProjectFile: (
    fileId: string,
    patch: Partial<Pick<ProjectFile, 'language' | 'content'>>
  ) => void;
  onDeleteCard: (cardId: string) => void;
  onDeleteProjectFile: (fileId: string) => void;
  onPromoteCardToProject: (cardId: string) => string | null;
  onRunDraft: (seed: Partial<CodeCard>) => void;
  onPromptChatCard: (card?: CodeChatPromptSeed | null) => void;
  onOpenSourceContext: (card: CodeCard) => void;
};

function LayerShell({
  title,
  body,
  onClose
}: {
  title: string;
  body: ReactNode;
  onClose?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="code-workshop-sheet workshop-layer__surface" data-surface={COLLECTION_FRONTSTAGE_SURFACES.promptBoard}>
      {onClose ? (
        <div className="code-workshop-document-bar">
          <button
            type="button"
            className="code-workshop-document-back"
            aria-label={t('collection.workshop.backToCardList')}
            title={t('collection.workshop.backToCardList')}
            onClick={(event) => {
              runImpactAction(onClose, { element: event.currentTarget });
            }}
          >
            <Icon name="chevron" size={17} />
          </button>
          <div className="code-workshop-document-status">
            <span>{title}</span>
            <small>{t('collection.workshop.documentAutosaves')}</small>
          </div>
          <div className="code-workshop-document-spacer" aria-hidden="true" />
        </div>
      ) : (
        <div className="code-workshop-sheet-bar">
          <div>
            <strong>{title}</strong>
          </div>
        </div>
      )}
      <div className="code-workshop-document-body">{body}</div>
    </div>
  );
}

export function CodeWorkshopLayer({
  mode,
  roomTags,
  activeRoomTag,
  activeCard,
  activeProjectFile,
  activeCardOriginLabel,
  activeCardSourceContext,
  onClose,
  onOpenCreate,
  onSaveCard,
  onUpdateCard,
  onUpdateProjectFile,
  onDeleteCard,
  onDeleteProjectFile,
  onPromoteCardToProject,
  onRunDraft,
  onPromptChatCard,
  onOpenSourceContext
}: CodeWorkshopLayerProps) {
  const { t } = useI18n();

  if (!mode) return null;

  if (mode === 'create') {
    return (
      <CreateCodeWorkshopFullscreen
        roomTags={roomTags}
        activeRoomTag={activeRoomTag}
        onClose={onClose}
        onSaveCard={onSaveCard}
        onRunDraft={onRunDraft}
      />
    );
  }

  const layer = (
    <div className="code-workshop-layer open" role="dialog" aria-modal="true">
      <div className="code-workshop-layer-scrim" />
      {activeProjectFile ? (
        <LayerShell
          title={activeProjectFile.filePath}
          onClose={onClose}
          body={resolveCodeCardPresentation({ kind: 'card', language: activeProjectFile.language }) === 'text' ? (
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
        />
      ) : activeCard ? (
        <LayerShell
          title={activeCard.title}
          onClose={onClose}
          body={resolveCodeCardPresentation(activeCard) === 'text' ? (
            <TextReadingWorkshop
              activeCard={activeCard}
              activeCardOriginLabel={activeCardOriginLabel}
              activeCardSourceContext={activeCardSourceContext}
              onUpdateCard={onUpdateCard}
              onDeleteCard={onDeleteCard}
              onPromoteCardToProject={onPromoteCardToProject}
              onPromptChatCard={onPromptChatCard}
              onOpenSourceContext={onOpenSourceContext}
            />
          ) : (
            <CodeWorkshop
              activeCard={activeCard}
              roomTags={roomTags}
              onUpdateCard={onUpdateCard}
              onPromoteCardToProject={onPromoteCardToProject}
              onPromptChatCard={onPromptChatCard}
            />
          )}
        />
      ) : (
        <LayerShell
          title={t('collection.workshop.title')}
          onClose={onClose}
          body={<CodeWorkshopEmptyState onOpenComposer={onOpenCreate} />}
        />
      )}
    </div>
  );

  if (typeof document === 'undefined') return layer;

  return createPortal(layer, document.body);
}
