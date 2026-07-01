import { describe, expect, it } from 'vitest';
import { buildThemeFrameFromPresetId } from '../config/theme/themePresets';
import { DEFAULT_APP_CUSTOMIZATION } from './runtimeStoreCustomization';
import { createInitialThemeState } from './spaceStoreTheme';
import {
  captureCollaboratorThemeSession,
  switchCollaboratorThemeSession
} from './spaceStoreCollaboratorThemes';

function buildOwnerState(overrides: Partial<Parameters<typeof switchCollaboratorThemeSession>[0]> = {}) {
  return {
    frontstageCollaboratorId: null,
    activeThemePreview: null,
    theme: createInitialThemeState(),
    customization: { ...DEFAULT_APP_CUSTOMIZATION },
    collaboratorThemes: {},
    ...overrides
  };
}

describe('switchCollaboratorThemeSession', () => {
  it('adopts the current global skin for the first collaborator after migration', () => {
    const paperTheme = {
      ...createInitialThemeState(),
      ...buildThemeFrameFromPresetId('paper-butter')
    };

    const result = switchCollaboratorThemeSession(buildOwnerState({
      theme: paperTheme,
      customization: {
        ...DEFAULT_APP_CUSTOMIZATION,
        backgroundAssetId: 'asset-bg'
      }
    }), 'pharos');

    expect(result.theme).toBe(paperTheme);
    expect(result.customization?.backgroundAssetId).toBe('asset-bg');
    expect(result.collaboratorThemes?.pharos?.theme.activePresetId).toBe('paper-butter');
    expect(result.collaboratorThemes?.pharos?.customization.backgroundAssetId).toBe('asset-bg');
  });

  it('saves the previous collaborator and restores the next collaborator skin', () => {
    const sharedSavedSkin = {
      id: 'saved-shared',
      name: 'Shared skin',
      sourcePresetId: 'paper-butter',
      cssVariables: buildThemeFrameFromPresetId('paper-butter').cssVariables,
      presetCSS: buildThemeFrameFromPresetId('paper-butter').presetCSS,
      customCSS: '',
      generatedCSS: '',
      createdAt: 1,
      updatedAt: 1
    };
    const pharosTheme = {
      ...createInitialThemeState(),
      ...buildThemeFrameFromPresetId('paper-butter'),
      toolMode: 'creative' as const,
      savedSkins: [sharedSavedSkin]
    };
    const lyraTheme = {
      ...createInitialThemeState(),
      ...buildThemeFrameFromPresetId('polaris-default'),
      toolMode: 'stable' as const,
      customCSS: '.app-shell { --accent: hotpink; }'
    };

    const result = switchCollaboratorThemeSession(buildOwnerState({
      frontstageCollaboratorId: 'pharos',
      theme: pharosTheme,
      customization: {
        ...DEFAULT_APP_CUSTOMIZATION,
        backgroundAssetId: 'asset-pharos'
      },
      collaboratorThemes: {
        lyra: captureCollaboratorThemeSession(lyraTheme, {
          ...DEFAULT_APP_CUSTOMIZATION,
          backgroundAssetId: 'asset-lyra'
        })
      }
    }), 'lyra');

    expect(result.theme?.customCSS).toContain('hotpink');
    expect(result.theme?.toolMode).toBe('creative');
    expect(result.theme?.savedSkins).toHaveLength(1);
    expect(result.theme?.savedSkins[0]?.id).toBe('saved-shared');
    expect(result.customization?.backgroundAssetId).toBe('asset-lyra');
    expect(result.collaboratorThemes?.pharos?.theme.activePresetId).toBe('paper-butter');
    expect(result.collaboratorThemes?.pharos?.theme.savedSkins).toHaveLength(0);
    expect(result.collaboratorThemes?.pharos?.customization.backgroundAssetId).toBe('asset-pharos');
  });

  it('keeps custom font settings global when switching collaborator rooms', () => {
    const result = switchCollaboratorThemeSession(buildOwnerState({
      frontstageCollaboratorId: 'pharos',
      customization: {
        ...DEFAULT_APP_CUSTOMIZATION,
        backgroundAssetId: 'asset-pharos',
        customFontAssetIds: ['asset-font-global'],
        customFontScopeAssignments: {
          global: 'asset-font-global',
          titles: null,
          chat: 'asset-font-global',
          cards: null
        }
      },
      collaboratorThemes: {
        lyra: captureCollaboratorThemeSession(createInitialThemeState(), {
          ...DEFAULT_APP_CUSTOMIZATION,
          backgroundAssetId: 'asset-lyra',
          customFontAssetIds: [],
          customFontScopeAssignments: {
            global: null,
            titles: null,
            chat: null,
            cards: null
          }
        })
      }
    }), 'lyra');

    expect(result.customization?.backgroundAssetId).toBe('asset-lyra');
    expect(result.customization?.customFontAssetIds).toEqual(['asset-font-global']);
    expect(result.customization?.customFontScopeAssignments.global).toBe('asset-font-global');
    expect(result.customization?.customFontScopeAssignments.chat).toBe('asset-font-global');
    expect(result.collaboratorThemes?.pharos?.customization.backgroundAssetId).toBe('asset-pharos');
  });

  it('keeps custom font settings global when opening a new collaborator room', () => {
    const result = switchCollaboratorThemeSession(buildOwnerState({
      frontstageCollaboratorId: 'pharos',
      customization: {
        ...DEFAULT_APP_CUSTOMIZATION,
        backgroundAssetId: 'asset-pharos',
        customFontAssetIds: ['asset-font-global'],
        customFontScopeAssignments: {
          global: 'asset-font-global',
          titles: null,
          chat: null,
          cards: null
        }
      },
      collaboratorThemes: {
        pharos: captureCollaboratorThemeSession(createInitialThemeState(), DEFAULT_APP_CUSTOMIZATION)
      }
    }), 'nova');

    expect(result.customization?.backgroundAssetId).toBeNull();
    expect(result.customization?.customFontAssetIds).toEqual(['asset-font-global']);
    expect(result.customization?.customFontScopeAssignments.global).toBe('asset-font-global');
    expect(result.collaboratorThemes?.nova?.customization.customFontAssetIds).toEqual([]);
  });

  it('stores the committed previous collaborator skin when switching during a preview', () => {
    const committedTheme = {
      ...createInitialThemeState(),
      ...buildThemeFrameFromPresetId('polaris-default')
    };
    const previewTheme = {
      ...createInitialThemeState(),
      ...buildThemeFrameFromPresetId('paper-butter')
    };

    const result = switchCollaboratorThemeSession(buildOwnerState({
      frontstageCollaboratorId: 'pharos',
      activeThemePreview: {
        id: 'preview-1',
        conversationId: 'conv-1',
        before: buildThemeFrameFromPresetId('polaris-default'),
        pending: '试穿纸页主题'
      },
      theme: previewTheme,
      collaboratorThemes: {
        lyra: captureCollaboratorThemeSession(committedTheme, DEFAULT_APP_CUSTOMIZATION)
      }
    }), 'lyra');

    expect(result.activeThemePreview).toBeNull();
    expect(result.collaboratorThemes?.pharos?.theme.activePresetId).toBe('polaris-default');
    expect(result.collaboratorThemes?.pharos?.theme.customCSS).toBe('');
    expect(result.theme?.activePresetId).toBe('polaris-default');
  });

  it('starts a new collaborator with a default skin once themes are scoped', () => {
    const result = switchCollaboratorThemeSession(buildOwnerState({
      frontstageCollaboratorId: 'pharos',
      theme: {
        ...createInitialThemeState(),
        toolMode: 'creative'
      },
      collaboratorThemes: {
        pharos: captureCollaboratorThemeSession(createInitialThemeState(), DEFAULT_APP_CUSTOMIZATION)
      }
    }), 'nova');

    expect(result.theme?.activePresetId).toBe('polaris-default');
    expect(result.theme?.toolMode).toBe('creative');
    expect(result.customization?.backgroundAssetId).toBeNull();
    expect(result.collaboratorThemes?.nova).toBeDefined();
  });
});
