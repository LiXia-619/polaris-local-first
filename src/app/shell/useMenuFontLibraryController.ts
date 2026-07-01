import { deleteAsset, saveAsset } from '../../infrastructure/assetStore';
import { canUseNativeSystemFilePicker, pickNativeSystemFiles } from '../../native/systemPickedFiles';
import { useSpaceStore } from '../../stores/spaceStore';
import type { AppCustomization, CustomFontScope } from '../../types/domain';

export const FONT_FILE_ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2,application/font-woff,application/font-woff2';

type MenuFontLibraryUi = {
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
  triggerBrowserFontPicker: () => void;
};

type UseMenuFontLibraryControllerArgs = {
  ui: MenuFontLibraryUi;
  customization: AppCustomization;
  setCustomization: (patch: Partial<AppCustomization>) => void;
  setPage: (page: 'fonts') => void;
};

export function isAcceptedFontFile(fileName: string, mimeType: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ['ttf', 'otf', 'woff', 'woff2'].includes(extension)
    || /^font\//i.test(mimeType)
    || /^application\/font-/i.test(mimeType)
    || /^application\/x-font-/i.test(mimeType);
}

export function resolveFontAssetMimeType(fileName: string, mimeType: string) {
  if (mimeType) return mimeType;
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'otf') return 'font/otf';
  if (extension === 'ttf') return 'font/ttf';
  return `font/${extension || 'font'}`;
}

export function addImportedCustomFont(
  customization: AppCustomization,
  assetId: string
): Partial<AppCustomization> {
  return {
    customFontAssetIds: [...(customization.customFontAssetIds ?? []), assetId],
    customFontScopeAssignments: customization.customFontScopeAssignments.global
      ? customization.customFontScopeAssignments
      : {
          ...customization.customFontScopeAssignments,
          global: assetId
        }
  };
}

export function assignCustomFontScope(
  customization: AppCustomization,
  scope: CustomFontScope,
  assetId: string | null
): Partial<AppCustomization> {
  const customFontAssetIds = assetId && !customization.customFontAssetIds.includes(assetId)
    ? [...customization.customFontAssetIds, assetId]
    : customization.customFontAssetIds;
  return {
    customFontAssetIds,
    customFontScopeAssignments: {
      ...customization.customFontScopeAssignments,
      [scope]: assetId
    }
  };
}

export function removeCustomFont(
  customization: AppCustomization,
  assetId: string
): Partial<AppCustomization> {
  const customFontScopeAssignments = { ...customization.customFontScopeAssignments };
  Object.entries(customFontScopeAssignments).forEach(([scope, assignedAssetId]) => {
    if (assignedAssetId === assetId) {
      customFontScopeAssignments[scope as CustomFontScope] = null;
    }
  });
  return {
    customFontAssetIds: customization.customFontAssetIds.filter((fontAssetId) => fontAssetId !== assetId),
    customFontScopeAssignments
  };
}

export function useMenuFontLibraryController({
  ui,
  customization,
  setCustomization,
  setPage
}: UseMenuFontLibraryControllerArgs) {
  const customFontCount = customization.customFontAssetIds?.length ?? 0;

  const importFontFile = async (file: File) => {
    if (!isAcceptedFontFile(file.name, file.type)) {
      ui.alert('请选择字体文件。');
      return;
    }

    try {
      const asset = await saveAsset({
        kind: 'file',
        name: file.name.trim() || 'font',
        mimeType: resolveFontAssetMimeType(file.name, file.type),
        blob: file
      });
      setCustomization(addImportedCustomFont(useSpaceStore.getState().customization, asset.id));
      setPage('fonts');
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入字体失败';
      ui.alert(message);
    }
  };

  const setCustomFontScope = (scope: CustomFontScope, assetId: string | null) => {
    setCustomization(assignCustomFontScope(useSpaceStore.getState().customization, scope, assetId));
  };

  const deleteCustomFont = async (assetId: string): Promise<boolean> => {
    const targetAssetId = assetId.trim();
    if (!targetAssetId) return false;
    if (!ui.confirm('删除这个字体吗？已使用它的作用域会改回跟随系统。')) return false;

    try {
      await deleteAsset(targetAssetId);
      setCustomization(removeCustomFont(useSpaceStore.getState().customization, targetAssetId));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除字体失败';
      ui.alert(message);
      return false;
    }
  };

  const importFont = () => {
    if (canUseNativeSystemFilePicker()) {
      void pickNativeSystemFiles({
        accept: FONT_FILE_ACCEPT,
        multiple: false
      }).then(async ([file]) => {
        if (file) {
          await importFontFile(file);
        }
      }).catch((error) => {
        ui.alert(error instanceof Error ? error.message : '导入字体失败。');
      });
      return;
    }
    ui.triggerBrowserFontPicker();
  };

  return {
    customFontCount,
    onSetCustomFontScope: setCustomFontScope,
    onDeleteCustomFont: deleteCustomFont,
    onImportFont: importFont,
    onImportFontBrowserFileSelected: async (file: File | null) => {
      if (!file) return;
      await importFontFile(file);
    }
  };
}
