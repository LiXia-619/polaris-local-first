import type { useThemeStudioController } from '../../../../app/theme/useThemeStudioController';
import { SavedSkinsSection } from '../../../sheets/themeStudio/SavedSkinsSection';
import { ThemeHistorySection } from '../../../sheets/themeStudio/ThemeHistorySection';

type ThemeStudioController = ReturnType<typeof useThemeStudioController>;

type RoomThemeLibrarySectionProps = {
  controller: ThemeStudioController;
};

export function RoomThemeLibrarySection({ controller }: RoomThemeLibrarySectionProps) {
  return (
    <div className="room-theme-library-page">
      <SavedSkinsSection
        theme={controller.theme}
        saveName={controller.saveName}
        copyFeedback={controller.savedSkinCopyFeedback}
        exportFeedback={controller.savedSkinExportFeedback}
        onSaveNameChange={controller.setSaveName}
        onSaveCurrentSkin={() => {
          const nextName = controller.saveName.trim() || controller.defaultSkinName;
          const savedSkin = controller.saveCurrentSkin(nextName);
          if (!savedSkin) return;
          controller.resetSaveName();
        }}
        onApplySavedSkin={controller.themeSession.applySavedSkin}
        onRenameSavedSkin={controller.renameSavedSkin}
        onUpdateSavedSkinCss={controller.updateSavedSkinCss}
        onCopySavedSkinFile={(savedSkinId) => { void controller.handleCopySavedSkinFile(savedSkinId); }}
        onExportSavedSkinFile={controller.handleExportSavedSkinFile}
        onDeleteSavedSkin={controller.deleteSavedSkin}
        getSavedSkinTargetSummary={controller.getSavedSkinTargetSummary}
        getSavedSkinEditableCss={controller.getSavedSkinEditableCss}
      />

      <ThemeHistorySection
        skinHistory={controller.theme.skinHistory}
        onRestoreSkinSnapshot={controller.themeSession.restoreSkinSnapshot}
      />
    </div>
  );
}
