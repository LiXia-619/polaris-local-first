import { createInitialThemeState } from './spaceStoreTheme';
import { DEFAULT_APP_CUSTOMIZATION } from './runtimeStoreCustomization';
import type { SpaceThemeState } from './spaceStoreTypes';

export function createInitialSpaceThemeState(): SpaceThemeState {
  return {
    activeThemePreview: null,
    theme: createInitialThemeState(),
    customization: {
      ...DEFAULT_APP_CUSTOMIZATION
    },
    collaboratorThemes: {}
  };
}
