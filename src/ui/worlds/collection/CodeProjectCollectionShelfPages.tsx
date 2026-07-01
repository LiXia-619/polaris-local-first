import { useEffect } from 'react';
import { useCodeCollectionWorkspaceController } from '../../../app/collection/useCodeCollectionWorkspaceController';
import { CodeCollectionShelf } from '../../collection/cards/CodeCollectionShelf';
import { ProjectCollectionShelf } from '../../collection/cards/ProjectCollectionShelf';

type CodeProjectCollectionShelfPagesProps = {
  activeShelf: 'code' | 'project';
  searchOpen: boolean;
  searchTerm: string;
  onWorkshopOpenChange: (open: boolean) => void;
  onOpenCardsShelf: () => void;
  onOpenDesktopLocalSettings: () => void;
};

export function CodeProjectCollectionShelfPages({
  activeShelf,
  searchOpen,
  searchTerm,
  onWorkshopOpenChange,
  onOpenCardsShelf,
  onOpenDesktopLocalSettings
}: CodeProjectCollectionShelfPagesProps) {
  const codeController = useCodeCollectionWorkspaceController({
    searchTerm,
    onWorkshopOpenChange
  });

  useEffect(() => () => onWorkshopOpenChange(false), [onWorkshopOpenChange]);

  useEffect(() => {
    if (!codeController.workshopMode) return;
    const page = document.querySelector<HTMLElement>('.collection-shelf-page--active');
    const pageScrollOwner = page?.querySelector<HTMLElement>('.code-collection-view-page-scroll');
    const frame = document.querySelector<HTMLElement>('.collection-frame.active');
    const scrollOwner = pageScrollOwner ?? page ?? frame;
    if (!scrollOwner) return;
    const syncTop = () => scrollOwner.scrollTo({ top: 0, behavior: 'auto' });
    syncTop();
    const rafId = window.requestAnimationFrame(syncTop);
    return () => window.cancelAnimationFrame(rafId);
  }, [codeController.workshopMode]);

  if (activeShelf === 'project') {
    return (
      <div
        className="collection-shelf-page collection-shelf-page--project collection-shelf-page--active"
        data-shelf-page="project"
      >
        <div className="collection-shelf-page-body">
          <ProjectCollectionShelf
            cardsExpanded={searchOpen}
            isAggregateScope={codeController.isAggregateScope}
            projectFiles={codeController.projectFiles}
            roomProjects={codeController.roomProjects}
            renderProjectFullscreen
            activeProject={codeController.activeProject}
            activeProjectFiles={codeController.activeProjectFiles}
            activeProjectReferenceDocs={codeController.activeProjectReferenceDocs}
            activeProjectConversations={codeController.activeProjectConversations}
            activeProjectFile={codeController.activeProjectFile}
            desktopSyncBusyProjectId={codeController.desktopSyncBusyProjectId}
            desktopSyncStatus={codeController.desktopSyncStatus}
            desktopCommand={codeController.desktopCommand}
            desktopCommandArgs={codeController.desktopCommandArgs}
            desktopCommandBusyProjectId={codeController.desktopCommandBusyProjectId}
            desktopCommandResult={codeController.desktopCommandResult}
            desktopCommandSessions={codeController.desktopCommandSessions}
            personas={codeController.collaborators}
            activeConversationId={codeController.activeConversationId}
            previewPresentation={codeController.previewState?.presentation ?? null}
            previewItemId={codeController.previewState?.previewItemId ?? null}
            previewProjectId={codeController.previewState?.projectId ?? null}
            previewProjectFileCount={codeController.previewState?.projectFileCount ?? null}
            previewTitle={codeController.previewState?.title ?? null}
            previewLanguage={codeController.previewState?.language ?? null}
            previewSrcDoc={codeController.previewState?.srcDoc ?? null}
            previewContent={codeController.previewState?.content ?? ''}
            onOpenProject={codeController.openProject}
            onCreateProject={() => {
              codeController.createWorkspaceProject();
            }}
            onCreateProjectFile={codeController.createProjectFileInWorkspace}
            onCreateWorkspaceReference={codeController.createWorkspaceReferenceInProject}
            onImportWorkspaceReference={codeController.importWorkspaceReferenceToProject}
            onUpdateWorkspaceReference={codeController.updateWorkspaceReference}
            onDeleteWorkspaceReference={codeController.deleteWorkspaceReferenceDoc}
            onCloseProject={codeController.closeProject}
            onCloseProjectFile={codeController.closeWorkshop}
            onRenameProject={codeController.renameProject}
            onSetProjectPreviewStateAccess={codeController.setProjectPreviewStateAccess}
            onToggleProjectPinned={codeController.toggleProjectPinned}
            onDeleteProject={(projectId) => {
              const targetProject = codeController.roomProjects.find((project) => project.id === projectId);
              const label = targetProject?.title?.trim() || '这个工作区';
              if (!window.confirm(`要删除“${label}”吗？`)) return;
              codeController.removeProject(projectId);
            }}
            onUpdateProjectFile={codeController.updateProjectFile}
            onDeleteProjectFile={codeController.removeEditableItem}
            onRunProject={codeController.runProject}
            onDesktopCommandChange={codeController.setDesktopCommand}
            onDesktopCommandArgsChange={codeController.setDesktopCommandArgs}
            onRunDesktopProjectCommand={codeController.runDesktopProjectCommand}
            onStopDesktopProjectCommand={codeController.stopDesktopProjectCommand}
            onInspectProjectChanges={codeController.inspectProjectChanges}
            onSyncProjectFromDisk={codeController.syncProjectFromDisk}
            onSyncProjectToDisk={codeController.syncProjectToDisk}
            onCreateProjectChat={(projectId) => {
              codeController.openProjectConversation(projectId);
            }}
            onOpenProjectChat={codeController.openExistingProjectConversation}
            onDeleteProjectChat={(conversationId, title) => {
              if (!window.confirm(`要删除“${title}”吗？`)) return;
              codeController.removeProjectConversation(conversationId);
            }}
            onOpenProjectFile={codeController.openProjectFileEditor}
            onPromptChatCard={codeController.promptChatCard}
            onOpenCardsShelf={onOpenCardsShelf}
            onOpenDesktopLocalSettings={onOpenDesktopLocalSettings}
            onClosePreview={codeController.closePreview}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="collection-shelf-page collection-shelf-page--code collection-shelf-page--active"
      data-shelf-page="code"
    >
      <div className="collection-shelf-page-body">
        <CodeCollectionShelf
          cardsExpanded={searchOpen}
          isAggregateScope={codeController.isAggregateScope}
          workshopMode={codeController.workshopMode}
          roomTags={codeController.roomTags}
          activeRoomTag={codeController.activeRoomTag}
          tagFilter={codeController.tagFilter}
          standaloneCards={codeController.standaloneCards}
          renderProjectFullscreen
          activeProject={codeController.activeProject}
          activeProjectFiles={codeController.activeProjectFiles}
          activeProjectReferenceDocs={codeController.activeProjectReferenceDocs}
          activeProjectConversations={codeController.activeProjectConversations}
          desktopSyncBusyProjectId={codeController.desktopSyncBusyProjectId}
          desktopSyncStatus={codeController.desktopSyncStatus}
          desktopCommand={codeController.desktopCommand}
          desktopCommandArgs={codeController.desktopCommandArgs}
          desktopCommandBusyProjectId={codeController.desktopCommandBusyProjectId}
          desktopCommandResult={codeController.desktopCommandResult}
          desktopCommandSessions={codeController.desktopCommandSessions}
          personas={codeController.collaborators}
          activeConversationId={codeController.activeConversationId}
          fileCards={codeController.fileCards}
          hasStandaloneCards={codeController.hasStandaloneCards}
          activeCardId={codeController.activeCardId}
          spotlightCardId={codeController.spotlightCardId}
          previewPresentation={codeController.previewState?.presentation ?? null}
          previewItemId={codeController.previewState?.previewItemId ?? null}
          previewProjectId={codeController.previewState?.projectId ?? null}
          previewProjectFileCount={codeController.previewState?.projectFileCount ?? null}
          previewTitle={codeController.previewState?.title ?? null}
          previewLanguage={codeController.previewState?.language ?? null}
          previewSrcDoc={codeController.previewState?.srcDoc ?? null}
          previewContent={codeController.previewState?.content ?? ''}
          resolveOriginCopy={codeController.resolveOriginCopy}
          activeCard={codeController.activeCard}
          activeProjectFile={codeController.activeProjectFile}
          activeCardOriginLabel={codeController.activeCardOriginLabel}
          activeCardSourceContext={codeController.activeCardSourceContext}
          onSaveCard={codeController.saveCard}
          onUpdateCard={codeController.updateCard}
          onToggleCardPinned={codeController.toggleCardPinned}
          onUpdateProjectFile={codeController.updateProjectFile}
          onOpenEditableItem={codeController.openEditableItem}
          onOpenProjectFileEditor={codeController.openProjectFileEditor}
          onCreateProjectFile={codeController.createProjectFileInWorkspace}
          onCreateWorkspaceReference={codeController.createWorkspaceReferenceInProject}
          onImportWorkspaceReference={codeController.importWorkspaceReferenceToProject}
          onUpdateWorkspaceReference={codeController.updateWorkspaceReference}
          onDeleteWorkspaceReference={codeController.deleteWorkspaceReferenceDoc}
          onOpenCreate={codeController.openCreate}
          onOpenProject={codeController.openProject}
          onToggleProjectPinned={codeController.toggleProjectPinned}
          onCreateProjectChat={codeController.openProjectConversation}
          onOpenProjectChat={codeController.openExistingProjectConversation}
          onDeleteProjectChat={(conversationId, title) => {
            if (!window.confirm(`要删除“${title}”吗？`)) return;
            codeController.removeProjectConversation(conversationId);
          }}
          onPromoteCardToProject={codeController.promoteCardToProject}
          onCloseProject={codeController.closeProject}
          onRenameProject={codeController.renameProject}
          onSetProjectPreviewStateAccess={codeController.setProjectPreviewStateAccess}
          onOpenChat={codeController.openChat}
          onTagFilterChange={codeController.setTagFilter}
          onCloseWorkshop={codeController.closeWorkshop}
          onPromptChatCard={codeController.promptChatCard}
          onOpenSourceContext={codeController.openSourceContext}
          onRunCard={codeController.runCard}
          onRunProject={codeController.runProject}
          onDesktopCommandChange={codeController.setDesktopCommand}
          onDesktopCommandArgsChange={codeController.setDesktopCommandArgs}
          onRunDesktopProjectCommand={codeController.runDesktopProjectCommand}
          onStopDesktopProjectCommand={codeController.stopDesktopProjectCommand}
          onInspectProjectChanges={codeController.inspectProjectChanges}
          onSyncProjectFromDisk={codeController.syncProjectFromDisk}
          onSyncProjectToDisk={codeController.syncProjectToDisk}
          onDeleteEditableItem={(itemId) => {
            const targetCard = codeController.cards.find((card) => card.id === itemId);
            const targetFile = codeController.projectFiles.find((file) => file.id === itemId);
            const label = targetCard?.title?.trim() || targetFile?.filePath?.trim() || '这张卡片';
            if (!window.confirm(`要删除“${label}”吗？`)) return;
            codeController.removeEditableItem(itemId);
          }}
          onDeleteProjectFile={codeController.removeEditableItem}
          onOpenFileSource={codeController.openFileSource}
          onRunDraft={codeController.runDraft}
          onOpenDesktopLocalSettings={onOpenDesktopLocalSettings}
          onClosePreview={codeController.closePreview}
        />
      </div>
    </div>
  );
}
