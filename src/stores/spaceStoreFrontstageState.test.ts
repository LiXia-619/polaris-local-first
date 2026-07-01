import { describe, expect, it } from 'vitest';
import {
  migratePersistedSpaceFrontstageState,
  serializePersistedSpaceFrontstageState,
  SPACE_FRONTSTAGE_SCHEMA_VERSION
} from './spaceStoreFrontstagePersistence';
import { DEFAULT_DISPLAY_PREFERENCES } from './spaceStoreDisplayPreferences';
import { createInitialSpaceFrontstageState } from './spaceStoreFrontstageState';

describe('createInitialSpaceFrontstageState', () => {
  it('defaults the frontstage to the dialogue shelf in room world', () => {
    expect(createInitialSpaceFrontstageState()).toEqual({
      activeWorld: 'collection',
      collectionShelf: 'dialogue',
      frontstageCollaboratorId: null,
      collectionProjectId: null,
      editingCollaboratorId: null,
      screenshotDebugOverlayEnabled: false,
      appLanguage: 'zh-CN',
      displayPreferences: DEFAULT_DISPLAY_PREFERENCES,
      focusedMessageTarget: null,
      activeCardId: null,
      spotlightCardId: null,
      pendingProjectOpenId: null,
      pendingProjectOpenSource: null,
      pendingCardReference: null,
      pendingAttachments: [],
      replyNotifications: []
    });
  });
});

describe('migratePersistedSpaceFrontstageState', () => {
  it('falls back to room world when an unversioned payload is missing activeWorld', () => {
    expect(migratePersistedSpaceFrontstageState({
      collectionShelf: 'code',
      currentCollaboratorId: null
    })).toEqual({
      activeWorld: 'collection',
      collectionShelf: 'code',
      frontstageCollaboratorId: null,
      collectionProjectId: null,
      editingCollaboratorId: null,
      screenshotDebugOverlayEnabled: false,
      appLanguage: 'zh-CN',
      displayPreferences: DEFAULT_DISPLAY_PREFERENCES,
      activeCardId: null,
      pendingProjectOpenId: null,
      pendingProjectOpenSource: null,
      pendingCardReference: null,
      pendingAttachments: []
    });
  });

  it('keeps an existing legacy chat world preference but drops stale workspace mirrors', () => {
    expect(migratePersistedSpaceFrontstageState({
      activeWorld: 'chat',
      collectionShelf: 'dialogue',
      frontstageCollaboratorId: 'pharos',
      frontstageProjectId: 'workspace-3',
      editingCollaboratorId: 'pharos',
      screenshotDebugOverlayEnabled: true
    })).toEqual({
      activeWorld: 'chat',
      collectionShelf: 'dialogue',
      frontstageCollaboratorId: 'pharos',
      collectionProjectId: null,
      editingCollaboratorId: 'pharos',
      screenshotDebugOverlayEnabled: true,
      appLanguage: 'zh-CN',
      displayPreferences: DEFAULT_DISPLAY_PREFERENCES,
      activeCardId: null,
      pendingProjectOpenId: null,
      pendingProjectOpenSource: null,
      pendingCardReference: null,
      pendingAttachments: []
    });
  });

  it('retires the legacy group shelf back to the collection info surface', () => {
    expect(migratePersistedSpaceFrontstageState({
      frontstageSchemaVersion: SPACE_FRONTSTAGE_SCHEMA_VERSION - 1,
      activeWorld: 'collection',
      collectionShelf: 'group',
      frontstageCollaboratorId: 'pharos'
    })).toEqual({
      activeWorld: 'collection',
      collectionShelf: 'info',
      frontstageCollaboratorId: 'pharos',
      collectionProjectId: null,
      editingCollaboratorId: null,
      screenshotDebugOverlayEnabled: false,
      appLanguage: 'zh-CN',
      displayPreferences: DEFAULT_DISPLAY_PREFERENCES,
      activeCardId: null,
      pendingProjectOpenId: null,
      pendingProjectOpenSource: null,
      pendingCardReference: null,
      pendingAttachments: []
    });
  });

  it('uses only current-schema fields when the payload is versioned', () => {
    expect(migratePersistedSpaceFrontstageState({
      frontstageSchemaVersion: SPACE_FRONTSTAGE_SCHEMA_VERSION,
      activeWorld: 'chat',
      collectionShelf: 'dialogue',
      frontstageCollaboratorId: null,
      currentCollaboratorId: 'legacy-collaborator',
      chatProjectId: 'stale-workspace',
      frontstageProjectId: 'legacy-workspace',
      collectionProjectId: 'workspace-2',
      editingCollaboratorId: 'pharos'
    })).toEqual({
      activeWorld: 'chat',
      collectionShelf: 'dialogue',
      frontstageCollaboratorId: null,
      collectionProjectId: 'workspace-2',
      editingCollaboratorId: 'pharos',
      screenshotDebugOverlayEnabled: false,
      appLanguage: 'zh-CN',
      displayPreferences: DEFAULT_DISPLAY_PREFERENCES,
      activeCardId: null,
      pendingProjectOpenId: null,
      pendingProjectOpenSource: null,
      pendingCardReference: null,
      pendingAttachments: []
    });
  });

  it('turns legacy default haptics into an explicit opt-in preference', () => {
    expect(migratePersistedSpaceFrontstageState({
      frontstageSchemaVersion: SPACE_FRONTSTAGE_SCHEMA_VERSION - 1,
      displayPreferences: {
        hapticsEnabled: true,
        fontScale: 1.08
      }
    }).displayPreferences).toEqual({
      appearance: 'system',
      hapticsEnabled: false,
      fontScale: 1.08
    });
  });

  it('keeps a current English interface preference', () => {
    expect(migratePersistedSpaceFrontstageState({
      frontstageSchemaVersion: SPACE_FRONTSTAGE_SCHEMA_VERSION,
      appLanguage: 'en-US'
    }).appLanguage).toBe('en-US');
  });

  it('falls back to Chinese for an unknown interface language', () => {
    expect(migratePersistedSpaceFrontstageState({
      frontstageSchemaVersion: SPACE_FRONTSTAGE_SCHEMA_VERSION,
      appLanguage: 'fr-FR'
    }).appLanguage).toBe('zh-CN');
  });
});

describe('serializePersistedSpaceFrontstageState', () => {
  it('writes the current frontstage schema without persisting the chat workspace mirror', () => {
    expect(serializePersistedSpaceFrontstageState({
      activeWorld: 'chat',
      collectionShelf: 'project',
      frontstageCollaboratorId: 'pharos',
      collectionProjectId: 'workspace-2',
      editingCollaboratorId: null,
      screenshotDebugOverlayEnabled: true,
      appLanguage: 'en-US',
      displayPreferences: {
        appearance: 'system',
        hapticsEnabled: false,
        fontScale: 1.12
      },
      activeCardId: 'card-1'
    })).toEqual({
      frontstageSchemaVersion: SPACE_FRONTSTAGE_SCHEMA_VERSION,
      activeWorld: 'chat',
      collectionShelf: 'project',
      frontstageCollaboratorId: 'pharos',
      collectionProjectId: 'workspace-2',
      editingCollaboratorId: null,
      screenshotDebugOverlayEnabled: true,
      appLanguage: 'en-US',
      displayPreferences: {
        appearance: 'system',
        hapticsEnabled: false,
        fontScale: 1.12
      },
      activeCardId: 'card-1'
    });
  });
});
