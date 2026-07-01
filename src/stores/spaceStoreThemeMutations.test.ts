import { describe, expect, it } from 'vitest';
import { buildThemeFrameFromPresetId } from '../config/theme/themePresets';
import { createInitialThemeState } from './spaceStoreTheme';
import { DEFAULT_APP_CUSTOMIZATION } from './runtimeStoreCustomization';
import {
  commitResolvedThemePreview,
  patchThemeSessionFields,
  replaceCommittedThemeFrame,
  replaceResolvedThemeFrame,
  replaceResolvedThemeFrameAndMarkPreview
} from './spaceStoreThemeMutations';

function buildState() {
  return {
    activeWorld: 'chat' as const,
    collectionShelf: 'code' as const,
    frontstageCollaboratorId: 'pharos' as string | null,
    activeThemePreview: {
      id: 'preview-1',
      conversationId: 'conv-1',
      before: buildThemeFrameFromPresetId('polaris-default'),
      pending: ''
    },
    theme: createInitialThemeState(),
    customization: { ...DEFAULT_APP_CUSTOMIZATION },
    collaboratorThemes: {},
    toggleWorld: () => {},
    setWorld: () => {},
    setCollectionShelf: () => {},
    setFrontstageCollaboratorId: () => {},
    beginThemePreview: () => ({ visibleThemeBeforeStart: buildThemeFrameFromPresetId('polaris-default') }),
    commitThemePreview: () => true,
    rollbackThemePreview: () => true,
    applyThemePreset: () => {},
    enterCustomThemeMode: () => {},
    setThemeToolMode: () => {},
    setSelectedSurfaceCodes: () => {},
    selectAllThemeSurfaces: () => {},
    applySavedSkin: () => {},
    applyThemePatch: () => {},
    setCustomCSS: () => {},
    clearCustomCSS: () => {},
    saveCurrentSkin: () => null,
    deleteSavedSkin: () => {},
    deleteCollaboratorThemeSession: () => {},
    commitSkinSnapshot: () => {},
    restoreSkinSnapshot: () => {},
    rollbackLastSkin: () => {}
  };
}

describe('spaceStoreThemeMutations', () => {
  it('replaces a committed theme frame and records the previous theme in history', () => {
    const state = buildState();
    const nextFrame = buildThemeFrameFromPresetId('paper-butter');

    const result = replaceCommittedThemeFrame(state, nextFrame);

    expect(result.activeThemePreview).toBeNull();
    expect(result.theme.activePresetId).toBe('paper-butter');
    expect(result.theme.skinHistory).toHaveLength(1);
    expect(result.theme.skinHistory[0]?.sourcePresetId).toBe(state.theme.activePresetId);
  });

  it('commits a preview and records the pre-preview theme in history', () => {
    const state = {
      ...buildState(),
      activeThemePreview: {
        ...buildState().activeThemePreview!,
        patchLedgerEntryId: 'theme-patch-1'
      },
      theme: {
        ...createInitialThemeState(),
        ...buildThemeFrameFromPresetId('paper-butter'),
        patchLedger: [{
          id: 'theme-patch-1',
          previewId: 'preview-1',
          conversationId: 'conv-1',
          kind: 'patchRawCss' as const,
          label: '黄油气泡',
          summary: '黄油气泡',
          status: 'preview' as const,
          layer: 'generated' as const,
          createdAt: 1,
          updatedAt: 1
        }]
      }
    };

    const result = commitResolvedThemePreview(state);

    expect(result.activeThemePreview).toBeNull();
    expect(result.theme.activePresetId).toBe('paper-butter');
    expect(result.theme.skinHistory).toHaveLength(1);
    expect(result.theme.skinHistory[0]?.sourcePresetId).toBe('polaris-default');
    expect(result.theme.patchLedger[0]?.status).toBe('applied');
  });

  it('replaces a resolved theme frame without adding a new snapshot by default', () => {
    const state = buildState();
    const nextFrame = buildThemeFrameFromPresetId('paper-butter');

    const result = replaceResolvedThemeFrame(state, nextFrame);

    expect(result.activeThemePreview).toBeNull();
    expect(result.theme.activePresetId).toBe('paper-butter');
    expect(result.theme.skinHistory).toHaveLength(0);
  });

  it('marks preview ledger entries rolled back while restoring the previous frame', () => {
    const state = {
      ...buildState(),
      theme: {
        ...createInitialThemeState(),
        ...buildThemeFrameFromPresetId('paper-butter'),
        patchLedger: [{
          id: 'theme-patch-1',
          previewId: 'preview-1',
          conversationId: 'conv-1',
          kind: 'patchRawCss' as const,
          label: '黄油气泡',
          summary: '黄油气泡',
          status: 'preview' as const,
          layer: 'generated' as const,
          createdAt: 1,
          updatedAt: 1
        }]
      }
    };

    const result = replaceResolvedThemeFrameAndMarkPreview(
      state,
      state.activeThemePreview!.before,
      'preview-1',
      'rolled_back'
    );

    expect(result.activeThemePreview).toBeNull();
    expect(result.theme.activePresetId).toBe('polaris-default');
    expect(result.theme.patchLedger[0]?.status).toBe('rolled_back');
  });

  it('patches theme session fields and clears the active preview', () => {
    const state = buildState();

    const result = patchThemeSessionFields(state, {
      activeSavedSkinId: null,
      customCSS: '.app-shell { --accent: hotpink; }'
    });

    expect(result.activeThemePreview).toBeNull();
    expect(result.theme.customCSS).toContain('hotpink');
  });
});
