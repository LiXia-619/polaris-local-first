import type {
  AppDisplayPreferences,
  AppCustomization,
  ChatAttachment,
  ChatCardReference,
  CollectionShelf,
  SavedSkin,
  ThemeFrame,
  ThemePatchLedgerEntry,
  ThemeState,
  ThemeToolMode,
  WorkspaceViewReturnTarget,
  World
} from '../types/domain';
import type { AppLanguage } from '../i18n/appLanguage';

export type CollaboratorThemeSession = {
  theme: ThemeState;
  customization: AppCustomization;
};

export type ActiveThemePreview = {
  id: string;
  conversationId: string;
  before: ThemeFrame;
  pending: string;
  patchLedgerEntryId?: string;
} | null;

export type AppReplyNotification = {
  id: string;
  kind: 'proactive-reply';
  collaboratorId: string;
  collaboratorName: string;
  conversationId: string;
  preview: string;
  createdAt: number;
};

export type AppReplyNotificationInput =
  & Omit<AppReplyNotification, 'id' | 'createdAt'>
  & Partial<Pick<AppReplyNotification, 'id' | 'createdAt'>>;

export type ThemePreviewStartResult = {
  visibleThemeBeforeStart: ThemeFrame;
};

export type SpaceFrontstageState = {
  activeWorld: World;
  collectionShelf: CollectionShelf;
  frontstageCollaboratorId: string | null;
  // Collection-side workspace selection that survives world switches.
  collectionProjectId: string | null;
  editingCollaboratorId: string | null;
  screenshotDebugOverlayEnabled: boolean;
  appLanguage: AppLanguage;
  displayPreferences: AppDisplayPreferences;
  focusedMessageTarget: { conversationId: string; messageId: string } | null;
  activeCardId: string | null;
  spotlightCardId: string | null;
  // One-shot bridge for "open this workspace in collection" jumps from chat.
  pendingProjectOpenId: string | null;
  pendingProjectOpenSource: WorkspaceViewReturnTarget;
  pendingCardReference: ChatCardReference | null;
  pendingAttachments: ChatAttachment[];
  replyNotifications: AppReplyNotification[];
};

export type SpaceThemeState = {
  activeThemePreview: ActiveThemePreview;
  theme: ThemeState;
  customization: AppCustomization;
  collaboratorThemes: Record<string, CollaboratorThemeSession>;
};

export type SpaceFrontstageActions = {
  toggleWorld: () => void;
  setWorld: (world: World) => void;
  setCollectionShelf: (shelf: CollectionShelf) => void;
  setFrontstageCollaboratorId: (collaboratorId: string | null) => void;
  setCollectionProjectId: (projectId: string | null) => void;
  setEditingCollaboratorId: (collaboratorId: string | null) => void;
  setScreenshotDebugOverlayEnabled: (enabled: boolean) => void;
  setAppLanguage: (language: AppLanguage) => void;
  setDisplayPreferences: (patch: Partial<AppDisplayPreferences>) => void;
  setFocusedMessageTarget: (target: { conversationId: string; messageId: string } | null) => void;
  setActiveCard: (cardId: string | null) => void;
  spotlightCard: (cardId: string | null) => void;
  clearSpotlightCard: (cardId?: string | null) => void;
  setPendingProjectOpenId: (projectId: string | null) => void;
  setPendingProjectOpenSource: (source: WorkspaceViewReturnTarget) => void;
  setPendingCardReference: (reference: ChatCardReference | null) => void;
  clearPendingCardReference: () => void;
  addPendingAttachments: (attachments: ChatAttachment[]) => void;
  removePendingAttachment: (attachmentId: string) => void;
  clearPendingAttachments: () => void;
  enqueueReplyNotification: (notification: AppReplyNotificationInput) => void;
  dismissReplyNotification: (notificationId: string) => void;
  clearReplyNotifications: () => void;
};

export type SpaceThemeActions = {
  beginThemePreview: (
    previewId: string,
    conversationId: string,
    nextTheme: ThemeFrame,
    pending: string,
    patchLedgerEntry?: Omit<ThemePatchLedgerEntry, 'status' | 'createdAt' | 'updatedAt'>
  ) => ThemePreviewStartResult;
  commitThemePreview: (previewId: string) => boolean;
  rollbackThemePreview: (previewId: string) => boolean;
  applyThemePreset: (presetId: string) => void;
  enterCustomThemeMode: () => void;
  setThemeToolMode: (mode: ThemeToolMode) => void;
  setSelectedSurfaceCodes: (codes: string[]) => void;
  selectAllThemeSurfaces: () => void;
  applySavedSkin: (savedSkinId: string) => void;
  applyThemePatch: (generatedCssPatch?: string) => void;
  setCustomization: (patch: Partial<AppCustomization>) => void;
  setCustomCSS: (cssText: string) => void;

  clearCustomCSS: () => void;
  saveCurrentSkin: (name: string) => SavedSkin | null;
  renameSavedSkin: (savedSkinId: string, name: string) => void;
  updateSavedSkinCss: (savedSkinId: string, customCSS: string) => void;
  deleteSavedSkin: (savedSkinId: string) => void;
  deleteCollaboratorThemeSession: (collaboratorId: string) => void;
  commitSkinSnapshot: (label?: string) => void;
  restoreSkinSnapshot: (snapshotId: string) => void;
  rollbackLastSkin: () => void;
};

export type SpaceState =
  & SpaceFrontstageState
  & SpaceThemeState
  & SpaceFrontstageActions
  & SpaceThemeActions;
