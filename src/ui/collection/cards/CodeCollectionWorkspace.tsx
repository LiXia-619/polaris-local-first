import { useEffect } from 'react';
import { useCodeCollectionWorkspaceController } from '../../../app/collection/useCodeCollectionWorkspaceController';
import { CodeCollectionShelf } from './CodeCollectionShelf';
import { useI18n } from '../../../i18n';

type CodeCollectionWorkspaceProps = {
  cardsExpanded: boolean;
  searchTerm: string;
  onWorkshopOpenChange: (open: boolean) => void;
};

export function CodeCollectionWorkspace({
  cardsExpanded,
  searchTerm,
  onWorkshopOpenChange
}: CodeCollectionWorkspaceProps) {
  const { t } = useI18n();
  const controller = useCodeCollectionWorkspaceController({
    searchTerm,
    onWorkshopOpenChange
  });

  useEffect(() => () => onWorkshopOpenChange(false), [onWorkshopOpenChange]);
  useEffect(() => {
    if (!controller.workshopMode) return;
    const page = document.querySelector<HTMLElement>('.collection-shelf-page--active');
    const pageScrollOwner = page?.querySelector<HTMLElement>('.code-collection-view-page-scroll');
    const frame = document.querySelector<HTMLElement>('.collection-frame.active');
    const scrollOwner = pageScrollOwner ?? page ?? frame;
    if (!scrollOwner) return;
    const syncTop = () => scrollOwner.scrollTo({ top: 0, behavior: 'auto' });
    syncTop();
    const rafId = window.requestAnimationFrame(syncTop);
    return () => window.cancelAnimationFrame(rafId);
  }, [controller.workshopMode]);

  return (
    <CodeCollectionShelf
      cardsExpanded={cardsExpanded}
      isAggregateScope={controller.isAggregateScope}
      workshopMode={controller.workshopMode}
      roomTags={controller.roomTags}
      activeRoomTag={controller.activeRoomTag}
      tagFilter={controller.tagFilter}
      standaloneCards={controller.standaloneCards}
      activeProject={controller.activeProject}
      activeProjectFiles={controller.activeProjectFiles}
      activeProjectReferenceDocs={controller.activeProjectReferenceDocs}
      activeProjectConversations={controller.activeProjectConversations}
      personas={controller.collaborators}
      activeConversationId={controller.activeConversationId}
      fileCards={controller.fileCards}
      hasStandaloneCards={controller.hasStandaloneCards}
      activeCardId={controller.activeCardId}
      spotlightCardId={controller.spotlightCardId}
      previewPresentation={controller.previewState?.presentation ?? null}
      previewItemId={controller.previewState?.previewItemId ?? null}
      previewProjectId={controller.previewState?.projectId ?? null}
      previewProjectFileCount={controller.previewState?.projectFileCount ?? null}
      previewTitle={controller.previewState?.title ?? null}
      previewLanguage={controller.previewState?.language ?? null}
      previewSrcDoc={controller.previewState?.srcDoc ?? null}
      previewContent={controller.previewState?.content ?? ''}
      resolveOriginCopy={controller.resolveOriginCopy}
      activeCard={controller.activeCard}
      activeProjectFile={controller.activeProjectFile}
      activeCardOriginLabel={controller.activeCardOriginLabel}
      activeCardSourceContext={controller.activeCardSourceContext}
      onSaveCard={controller.saveCard}
      onUpdateCard={controller.updateCard}
      onToggleCardPinned={controller.toggleCardPinned}
      onUpdateProjectFile={controller.updateProjectFile}
      onOpenEditableItem={controller.openEditableItem}
      onOpenProjectFileEditor={controller.openProjectFileEditor}
      onCreateProjectFile={controller.createProjectFileInWorkspace}
      onCreateWorkspaceReference={controller.createWorkspaceReferenceInProject}
      onImportWorkspaceReference={controller.importWorkspaceReferenceToProject}
      onUpdateWorkspaceReference={controller.updateWorkspaceReference}
      onDeleteWorkspaceReference={controller.deleteWorkspaceReferenceDoc}
      onOpenCreate={controller.openCreate}
      onOpenProject={controller.openProject}
      onToggleProjectPinned={controller.toggleProjectPinned}
      onCreateProjectChat={controller.openProjectConversation}
      onOpenProjectChat={controller.openExistingProjectConversation}
      onDeleteProjectChat={(conversationId, title) => {
        if (!window.confirm(t('collection.code.deleteProjectChatConfirm', { title }))) return;
        controller.removeProjectConversation(conversationId);
      }}
      onPromoteCardToProject={controller.promoteCardToProject}
      onCloseProject={controller.closeProject}
      onRenameProject={controller.renameProject}
      onSetProjectPreviewStateAccess={controller.setProjectPreviewStateAccess}
      onTagFilterChange={controller.setTagFilter}
      onCloseWorkshop={controller.closeWorkshop}
      onPromptChatCard={controller.promptChatCard}
      onOpenSourceContext={controller.openSourceContext}
      onOpenChat={controller.openChat}
      onDeleteEditableItem={(itemId) => {
        const targetCard = controller.cards.find((card) => card.id === itemId);
        const targetFile = controller.projectFiles.find((file) => file.id === itemId);
        const label = targetCard?.title?.trim() || targetFile?.filePath?.trim() || t('collection.code.deleteEditableFallback');
        if (!window.confirm(t('collection.code.deleteEditableConfirm', { title: label }))) return;
        controller.removeEditableItem(itemId);
      }}
      onDeleteProjectFile={controller.removeEditableItem}
      onOpenFileSource={controller.openFileSource}
      onRunCard={controller.runCard}
      onRunProject={controller.runProject}
      onRunDraft={controller.runDraft}
      onClosePreview={controller.closePreview}
    />
  );
}
