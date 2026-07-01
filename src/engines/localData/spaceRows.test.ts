import { describe, expect, it } from 'vitest';
import type { AppCustomization, SavedSkin, ThemeState } from '../../types/domain';
import { DEFAULT_APP_CUSTOMIZATION } from '../../stores/runtimeStoreCustomization';
import { createInitialThemeState } from '../../stores/spaceStoreTheme';
import {
  buildSpaceLocalDataUnitOfWork,
  getSpaceDomainMetaLocalDataRef,
  getSpaceObjectLocalDataRef,
  toSpaceObjectId
} from './spaceRows';

function theme(seed: Partial<ThemeState> = {}): ThemeState {
  return {
    ...createInitialThemeState(),
    ...seed,
    cssVariables: {
      ...createInitialThemeState().cssVariables,
      ...seed.cssVariables
    },
    savedSkins: seed.savedSkins ?? [],
    skinHistory: seed.skinHistory ?? [],
    patchLedger: seed.patchLedger ?? []
  };
}

function savedSkin(seed: Partial<SavedSkin> & Pick<SavedSkin, 'id'>): SavedSkin {
  return {
    name: seed.name ?? seed.id,
    sourcePresetId: null,
    cssVariables: {},
    presetCSS: '',
    customCSS: '',
    generatedCSS: '',
    createdAt: 10,
    updatedAt: 10,
    ...seed,
    id: seed.id
  };
}

function customization(seed: Partial<AppCustomization> = {}): AppCustomization {
  return {
    ...DEFAULT_APP_CUSTOMIZATION,
    ...seed,
    customFontAssetIds: seed.customFontAssetIds ?? [],
    customFontScopeAssignments: {
      ...DEFAULT_APP_CUSTOMIZATION.customFontScopeAssignments,
      ...seed.customFontScopeAssignments
    }
  };
}

describe('buildSpaceLocalDataUnitOfWork', () => {
  it('projects frontstage, theme, customization, and collaborator themes into independent rows', () => {
    const currentTheme = theme({
      customCSS: '.hero { background: url(polaris-asset://asset-theme); }',
      savedSkins: [savedSkin({
        id: 'skin-1',
        generatedCSS: '.skin { background: url(polaris-asset://asset-skin); }',
        updatedAt: 80
      })]
    });
    const unit = buildSpaceLocalDataUnitOfWork({
      id: 'space-migration',
      version: 2,
      updatedAt: 50,
      state: {
        activeWorld: 'collection',
        collectionShelf: 'project',
        frontstageCollaboratorId: 'pharos',
        collectionProjectId: 'project-1',
        editingCollaboratorId: null,
        screenshotDebugOverlayEnabled: true,
        appLanguage: 'en-US',
        displayPreferences: {
          appearance: 'system',
          hapticsEnabled: true,
          fontScale: 1
        },
        activeCardId: 'card-1',
        theme: currentTheme,
        customization: customization({
          backgroundAssetId: 'asset-background',
          customFontAssetIds: ['asset-font']
        }),
        collaboratorThemes: {
          pharos: {
            theme: theme({
              customCSS: '.room { background: url(polaris-asset://asset-room); }'
            }),
            customization: customization({
              backgroundAssetId: 'asset-room-background'
            })
          }
        }
      }
    });

    expect(unit).toEqual(expect.objectContaining({
      id: 'space-migration',
      domain: 'space',
      version: 2
    }));
    // domainMeta + frontstage + theme + customization + collaborator-theme + skin.
    expect(unit.mutations).toHaveLength(6);
    expect(unit.mutations[0]).toEqual(expect.objectContaining({
      type: 'put',
      row: expect.objectContaining({
        ref: getSpaceDomainMetaLocalDataRef(),
        value: expect.objectContaining({
          frontstageCollaboratorId: 'pharos',
          collectionProjectId: 'project-1',
          activeObjectCount: 5,
          objectCounts: {
            frontstage: 1,
            theme: 1,
            customization: 1,
            'collaborator-theme': 1,
            skin: 1
          }
        })
      })
    }));
    expect(unit.mutations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getSpaceObjectLocalDataRef('frontstage', 'space-frontstage'),
          value: expect.objectContaining({
            objectId: toSpaceObjectId('frontstage', 'space-frontstage'),
            assetRefs: [],
            value: expect.objectContaining({
              activeWorld: 'collection',
              collectionShelf: 'project',
              appLanguage: 'en-US',
              activeCardId: 'card-1'
            })
          })
        })
      }),
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getSpaceObjectLocalDataRef('theme', 'space-theme'),
          updatedAt: 50,
          value: expect.objectContaining({
            // The saved-skin CSS ref moved out to the skin row; the theme row keeps its own.
            assetRefs: ['asset-theme'],
            value: expect.objectContaining({
              savedSkinOrder: ['skin-1'],
              savedSkinCount: 1,
              assetRefs: ['asset-theme'],
              // The library is stripped from the stored ThemeState.
              value: expect.objectContaining({ savedSkins: [] })
            })
          })
        })
      }),
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getSpaceObjectLocalDataRef('skin', 'skin-1'),
          updatedAt: 50,
          value: expect.objectContaining({
            objectId: toSpaceObjectId('skin', 'skin-1'),
            assetRefs: ['asset-skin'],
            value: expect.objectContaining({ id: 'skin-1' })
          })
        })
      }),
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getSpaceObjectLocalDataRef('customization', 'space-customization'),
          value: expect.objectContaining({
            assetRefs: ['asset-background', 'asset-font']
          })
        })
      }),
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getSpaceObjectLocalDataRef('collaborator-theme', 'pharos'),
          value: expect.objectContaining({
            ownerCollaboratorId: 'pharos',
            assetRefs: ['asset-room', 'asset-room-background']
          })
        })
      })
    ]));
  });
});
