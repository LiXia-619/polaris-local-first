import type { SpaceFrontstageState } from './spaceStoreTypes';
import { DEFAULT_DISPLAY_PREFERENCES } from './spaceStoreDisplayPreferences';
import { DEFAULT_APP_LANGUAGE } from '../i18n/appLanguage';

export function createInitialSpaceFrontstageState(): SpaceFrontstageState {
  return {
    activeWorld: 'collection',
    collectionShelf: 'dialogue',
    frontstageCollaboratorId: null,
    collectionProjectId: null,
    editingCollaboratorId: null,
    screenshotDebugOverlayEnabled: false,
    appLanguage: DEFAULT_APP_LANGUAGE,
    displayPreferences: { ...DEFAULT_DISPLAY_PREFERENCES },
    focusedMessageTarget: null,
    activeCardId: null,
    spotlightCardId: null,
    pendingProjectOpenId: null,
    pendingProjectOpenSource: null,
    pendingCardReference: null,
    pendingAttachments: [],
    replyNotifications: []
  };
}
