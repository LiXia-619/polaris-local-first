import {
  buildCustomThemeFrame,
  getThemePresetById
} from '../config/theme/themePresets';
import { applyGeneratedThemePatchToFrame, resolveThemeActionFrameChange } from '../engines/themeToolState';
import {
  buildThemePreviewStartResult,
} from './spaceStorePreviewState';
import {
  ALL_THEME_SURFACE_CODES,
  normalizeSelectedSurfaceCodes,
  savedSkinToThemeFrame
} from './spaceStoreTheme';
import type { ThemeFrame, ThemeToolMode } from '../types/domain';
import type { SpaceStoreSet } from './spaceStoreActionShared';
import { patchThemeFields } from './spaceStoreActionShared';
import type { SpaceState, SpaceThemeActions, ThemePreviewStartResult } from './spaceStoreTypes';
import { applyThemeFrame, normalizeFrame, toThemeFrame, withSnapshot } from './spaceStoreTheme';
import {
  appendThemePatchLedgerEntry,
  commitResolvedThemePreview,
  markThemePatchLedgerStatus,
  patchThemeSessionFields,
  replaceCommittedThemeFrame,
  replaceResolvedThemeFrameAndMarkPreview
} from './spaceStoreThemeMutations';

function applyThemePatchToState(
  state: SpaceState,
  generatedCssPatch?: string
) {
  const nextTheme = applyGeneratedThemePatchToFrame(toThemeFrame(state.theme), generatedCssPatch);
  return patchThemeFields(state, {
    activeSavedSkinId: nextTheme.activeSavedSkinId,
    generatedCSS: nextTheme.generatedCSS
  });
}

export function createSpaceThemeActions(set: SpaceStoreSet) {
  return {
    beginThemePreview: (
      previewId: string,
      conversationId: string,
      nextTheme: ThemeFrame,
      pending: string,
      patchLedgerEntry
    ) => {
      let result!: ThemePreviewStartResult;
      set((state) => {
        const currentTheme = toThemeFrame(state.theme);
        const committedTheme = state.activeThemePreview ? state.activeThemePreview.before : currentTheme;

        result = buildThemePreviewStartResult(currentTheme);

        const nextVisibleTheme = applyThemeFrame(state.theme, normalizeFrame(state.theme, nextTheme));
        const supersededTheme = state.activeThemePreview
          ? markThemePatchLedgerStatus(nextVisibleTheme, state.activeThemePreview.id, 'superseded')
          : nextVisibleTheme;
        const theme = patchLedgerEntry
          ? appendThemePatchLedgerEntry(supersededTheme, patchLedgerEntry)
          : supersededTheme;

        return {
          ...state,
          activeThemePreview: {
            id: previewId,
            conversationId,
            before: {
              activePresetId: committedTheme.activePresetId,
              activeSavedSkinId: committedTheme.activeSavedSkinId,
              cssVariables: { ...committedTheme.cssVariables },
              presetCSS: committedTheme.presetCSS,
              customCSS: committedTheme.customCSS,
              generatedCSS: committedTheme.generatedCSS,
              recipe: committedTheme.recipe ? { ...committedTheme.recipe } : undefined
            },
            pending,
            patchLedgerEntryId: patchLedgerEntry?.id
          },
          theme
        };
      });
      return result;
    },
    commitThemePreview: (previewId: string) => {
      let didCommit = false;
      set((state) => {
        if (state.activeThemePreview?.id !== previewId) return state;
        didCommit = true;
        return commitResolvedThemePreview(state);
      });
      return didCommit;
    },
    rollbackThemePreview: (previewId: string) => {
      let didRollback = false;
      set((state) => {
        if (state.activeThemePreview?.id !== previewId) return state;
        didRollback = true;
        return replaceResolvedThemeFrameAndMarkPreview(state, state.activeThemePreview.before, previewId, 'rolled_back');
      });
      return didRollback;
    },
    applyThemePreset: (presetId: string) =>
      set((state) => {
        const preset = getThemePresetById(presetId);
        if (!preset) return state;
        const frameResult = resolveThemeActionFrameChange(toThemeFrame(state.theme), {
          kind: 'applyPreset',
          presetId: preset.id
        });
        if (!frameResult.ok) return state;
        return replaceCommittedThemeFrame(state, frameResult.nextTheme);
      }),
    enterCustomThemeMode: () =>
      set((state) => {
        const nextTheme = buildCustomThemeFrame();
        return replaceCommittedThemeFrame(state, nextTheme);
      }),
    setThemeToolMode: (toolMode: ThemeToolMode) =>
      set((state) => ({
        ...state,
        ...patchThemeFields(state, {
          toolMode
        })
      })),
    setSelectedSurfaceCodes: (selectedSurfaceCodes: string[]) =>
      set((state) => ({
        ...state,
        ...patchThemeFields(state, {
          selectedSurfaceCodes: normalizeSelectedSurfaceCodes(selectedSurfaceCodes)
        })
      })),
    selectAllThemeSurfaces: () =>
      set((state) => ({
        ...state,
        ...patchThemeFields(state, {
          selectedSurfaceCodes: []
        })
      })),
    applySavedSkin: (savedSkinId: string) =>
      set((state) => {
        const savedSkin = state.theme.savedSkins.find((item) => item.id === savedSkinId);
        if (!savedSkin) return state;
        const nextTheme = savedSkinToThemeFrame(savedSkin);
        return replaceCommittedThemeFrame(state, nextTheme);
      }),
    applyThemePatch: (generatedCssPatch) =>
      set((state) => applyThemePatchToState(state, generatedCssPatch)),
    setCustomCSS: (customCSS: string) =>
      set((state) => patchThemeSessionFields(state, {
          activeSavedSkinId: null,
          customCSS
        })),
    clearCustomCSS: () =>
      set((state) => patchThemeSessionFields(state, {
          activeSavedSkinId: null,
          customCSS: ''
        }))
  } satisfies Pick<
    SpaceThemeActions,
    | 'beginThemePreview'
    | 'commitThemePreview'
    | 'rollbackThemePreview'
    | 'applyThemePreset'
    | 'enterCustomThemeMode'
    | 'setThemeToolMode'
    | 'setSelectedSurfaceCodes'
    | 'selectAllThemeSurfaces'
    | 'applySavedSkin'
    | 'applyThemePatch'
    | 'setCustomCSS'

    | 'clearCustomCSS'
  >;
}
