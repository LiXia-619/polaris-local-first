import { useMemo } from 'react';
import { useSpaceStore } from './spaceStore';

export function useSpaceFrontstageBindings() {
  const activeWorld = useSpaceStore((state) => state.activeWorld);
  const collectionShelf = useSpaceStore((state) => state.collectionShelf);
  const frontstageCollaboratorId = useSpaceStore((state) => state.frontstageCollaboratorId);
  const collectionProjectId = useSpaceStore((state) => state.collectionProjectId);
  const editingCollaboratorId = useSpaceStore((state) => state.editingCollaboratorId);
  const screenshotDebugOverlayEnabled = useSpaceStore((state) => state.screenshotDebugOverlayEnabled);
  const displayPreferences = useSpaceStore((state) => state.displayPreferences);
  const focusedMessageTarget = useSpaceStore((state) => state.focusedMessageTarget);
  const activeCardId = useSpaceStore((state) => state.activeCardId);
  const spotlightCardId = useSpaceStore((state) => state.spotlightCardId);
  const pendingProjectOpenId = useSpaceStore((state) => state.pendingProjectOpenId);
  const pendingProjectOpenSource = useSpaceStore((state) => state.pendingProjectOpenSource);
  const pendingCardReference = useSpaceStore((state) => state.pendingCardReference);
  const pendingAttachments = useSpaceStore((state) => state.pendingAttachments);
  const replyNotifications = useSpaceStore((state) => state.replyNotifications);
  const toggleWorld = useSpaceStore((state) => state.toggleWorld);
  const setWorld = useSpaceStore((state) => state.setWorld);
  const setCollectionShelf = useSpaceStore((state) => state.setCollectionShelf);
  const setFrontstageCollaboratorId = useSpaceStore((state) => state.setFrontstageCollaboratorId);
  const setCollectionProjectId = useSpaceStore((state) => state.setCollectionProjectId);
  const setEditingCollaboratorId = useSpaceStore((state) => state.setEditingCollaboratorId);
  const setScreenshotDebugOverlayEnabled = useSpaceStore((state) => state.setScreenshotDebugOverlayEnabled);
  const setDisplayPreferences = useSpaceStore((state) => state.setDisplayPreferences);
  const setFocusedMessageTarget = useSpaceStore((state) => state.setFocusedMessageTarget);
  const setActiveCard = useSpaceStore((state) => state.setActiveCard);
  const spotlightCard = useSpaceStore((state) => state.spotlightCard);
  const clearSpotlightCard = useSpaceStore((state) => state.clearSpotlightCard);
  const setPendingProjectOpenId = useSpaceStore((state) => state.setPendingProjectOpenId);
  const setPendingProjectOpenSource = useSpaceStore((state) => state.setPendingProjectOpenSource);
  const setPendingCardReference = useSpaceStore((state) => state.setPendingCardReference);
  const clearPendingCardReference = useSpaceStore((state) => state.clearPendingCardReference);
  const addPendingAttachments = useSpaceStore((state) => state.addPendingAttachments);
  const removePendingAttachment = useSpaceStore((state) => state.removePendingAttachment);
  const clearPendingAttachments = useSpaceStore((state) => state.clearPendingAttachments);
  const enqueueReplyNotification = useSpaceStore((state) => state.enqueueReplyNotification);
  const dismissReplyNotification = useSpaceStore((state) => state.dismissReplyNotification);
  const clearReplyNotifications = useSpaceStore((state) => state.clearReplyNotifications);

  return useMemo(() => ({
    activeWorld,
    collectionShelf,
    frontstageCollaboratorId,
    collectionProjectId,
    editingCollaboratorId,
    screenshotDebugOverlayEnabled,
    displayPreferences,
    focusedMessageTarget,
    activeCardId,
    spotlightCardId,
    pendingProjectOpenId,
    pendingProjectOpenSource,
    pendingCardReference,
    pendingAttachments,
    replyNotifications,
    toggleWorld,
    setWorld,
    setCollectionShelf,
    setFrontstageCollaboratorId,
    setCollectionProjectId,
    setEditingCollaboratorId,
    setScreenshotDebugOverlayEnabled,
    setDisplayPreferences,
    setFocusedMessageTarget,
    setActiveCard,
    spotlightCard,
    clearSpotlightCard,
    setPendingProjectOpenId,
    setPendingProjectOpenSource,
    setPendingCardReference,
    clearPendingCardReference,
    addPendingAttachments,
    removePendingAttachment,
    clearPendingAttachments,
    enqueueReplyNotification,
    dismissReplyNotification,
    clearReplyNotifications
  }), [
    activeWorld,
    collectionShelf,
    frontstageCollaboratorId,
    collectionProjectId,
    editingCollaboratorId,
    screenshotDebugOverlayEnabled,
    displayPreferences,
    focusedMessageTarget,
    activeCardId,
    spotlightCardId,
    pendingProjectOpenId,
    pendingProjectOpenSource,
    pendingCardReference,
    pendingAttachments,
    replyNotifications,
    toggleWorld,
    setWorld,
    setCollectionShelf,
    setFrontstageCollaboratorId,
    setCollectionProjectId,
    setEditingCollaboratorId,
    setScreenshotDebugOverlayEnabled,
    setDisplayPreferences,
    setFocusedMessageTarget,
    setActiveCard,
    spotlightCard,
    clearSpotlightCard,
    setPendingProjectOpenId,
    setPendingProjectOpenSource,
    setPendingCardReference,
    clearPendingCardReference,
    addPendingAttachments,
    removePendingAttachment,
    clearPendingAttachments,
    enqueueReplyNotification,
    dismissReplyNotification,
    clearReplyNotifications
  ]);
}

export type SpaceFrontstageBindings = ReturnType<typeof useSpaceFrontstageBindings>;
