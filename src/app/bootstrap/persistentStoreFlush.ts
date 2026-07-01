import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { registerPageLifecycleFlush } from '../../infrastructure/pageLifecycleFlush';
import { reportPersistenceError } from '../../infrastructure/persistenceDiagnostics';
import { flushAllRoomStates } from '../../engines/roomStatePersistence';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePersonaStore } from '../../stores/personaStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { writePersistedSpaceThemeState } from '../../stores/spaceStorePersistence';

const PERSIST_DEBOUNCE_MS = 180;
const PERSIST_RETRY_INITIAL_MS = 3000;
const PERSIST_RETRY_MAX_MS = 30000;

export function createPersistScheduler(persist: () => Promise<void>) {
  let timeoutId: number | null = null;
  let retryTimeoutId: number | null = null;
  let pendingWrite: Promise<void> | null = null;
  let shouldWriteAgain = false;
  let retryDelayMs = PERSIST_RETRY_INITIAL_MS;

  const clearScheduledRetry = () => {
    if (typeof window === 'undefined' || retryTimeoutId === null) return;
    window.clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  };

  const queueRetry = () => {
    if (typeof window === 'undefined' || retryTimeoutId !== null) return;
    const delayMs = retryDelayMs;
    retryDelayMs = Math.min(PERSIST_RETRY_MAX_MS, retryDelayMs * 2);
    retryTimeoutId = window.setTimeout(() => {
      retryTimeoutId = null;
      void runPersist().catch((error) => {
        reportPersistenceError({ label: '[store:persist]', store: 'scheduler', operation: 'retry-write' }, error);
        queueRetry();
      });
    }, delayMs);
  };

  const runPersist = () => {
    if (pendingWrite) {
      shouldWriteAgain = true;
      return pendingWrite;
    }

    pendingWrite = (async () => {
      do {
        shouldWriteAgain = false;
        await persist();
      } while (shouldWriteAgain);
      retryDelayMs = PERSIST_RETRY_INITIAL_MS;
    })().finally(() => {
      pendingWrite = null;
    });

    return pendingWrite;
  };

  return {
    schedule() {
      if (typeof window === 'undefined') return;
      clearScheduledRetry();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void runPersist().catch((error) => {
          reportPersistenceError({ label: '[store:persist]', store: 'scheduler', operation: 'debounced-write' }, error);
          queueRetry();
        });
      }, PERSIST_DEBOUNCE_MS);
    },
    flush() {
      if (typeof window !== 'undefined' && timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      clearScheduledRetry();
      timeoutId = null;
      return runPersist().catch((error) => {
        queueRetry();
        throw error;
      });
    },
    cleanup() {
      if (typeof window === 'undefined') return;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      clearScheduledRetry();
    }
  };
}

export type PersistScheduler = ReturnType<typeof createPersistScheduler>;

type HydratedSnapshot = {
  hydrated: boolean;
};

export function flushPersistSchedulerIfHydrated(
  state: HydratedSnapshot,
  scheduler: Pick<PersistScheduler, 'flush'>
) {
  return state.hydrated ? scheduler.flush() : Promise.resolve();
}

type ChatPersistSnapshot = HydratedSnapshot & {
  conversationPersistVersion: number;
};

type PersonaPersistSnapshot = HydratedSnapshot & {
  activeCollaboratorId: string | null;
  personas: unknown;
  seededDefaultPersonaIds: unknown;
};

type RuntimePersistSnapshot = HydratedSnapshot & {
  activeProviderId: string | null;
  providers: unknown;
  webdav: unknown;
  search: unknown;
  conversationSummaryModel: unknown;
  memoryVectorRetrieval: unknown;
  imageGeneration: unknown;
  imageUnderstanding: unknown;
  voiceGeneration: unknown;
  toolPromptPreferences: unknown;
  taskModeEnabled: boolean;
  mcpServers: unknown;
  mcpToolTimeoutSeconds: number;
  companionHost: unknown;
  companionConnections: unknown;
  triggerRules: unknown;
};

type CollectionPersistSnapshot = HydratedSnapshot & {
  cards: unknown;
  projectFiles: unknown;
  workspaceReferenceDocs?: unknown;
  roomProjects: unknown;
  imageCards: unknown;
};

type SpaceThemePersistSnapshot = {
  activeThemePreview: unknown;
  theme: unknown;
  customization: unknown;
  collaboratorThemes: unknown;
};

type SpacePersistSnapshot = SpaceThemePersistSnapshot & {
  activeWorld: unknown;
  collectionShelf: unknown;
  frontstageCollaboratorId: unknown;
  collectionProjectId: unknown;
  editingCollaboratorId: unknown;
  screenshotDebugOverlayEnabled: unknown;
  displayPreferences: unknown;
  activeCardId: unknown;
};

function isSettledHydrationChange(state: HydratedSnapshot, prevState: HydratedSnapshot) {
  return state.hydrated && prevState.hydrated;
}

export function shouldPersistChatState(state: ChatPersistSnapshot, prevState: ChatPersistSnapshot) {
  return isSettledHydrationChange(state, prevState) && (
    state.conversationPersistVersion !== prevState.conversationPersistVersion
  );
}

export function shouldPersistPersonaState(state: PersonaPersistSnapshot, prevState: PersonaPersistSnapshot) {
  return isSettledHydrationChange(state, prevState) && (
    state.activeCollaboratorId !== prevState.activeCollaboratorId ||
    state.personas !== prevState.personas ||
    state.seededDefaultPersonaIds !== prevState.seededDefaultPersonaIds
  );
}

export function shouldPersistRuntimeState(state: RuntimePersistSnapshot, prevState: RuntimePersistSnapshot) {
  return isSettledHydrationChange(state, prevState) && (
    state.activeProviderId !== prevState.activeProviderId ||
    state.providers !== prevState.providers ||
    state.webdav !== prevState.webdav ||
    state.search !== prevState.search ||
    state.conversationSummaryModel !== prevState.conversationSummaryModel ||
    state.memoryVectorRetrieval !== prevState.memoryVectorRetrieval ||
    state.imageGeneration !== prevState.imageGeneration ||
    state.imageUnderstanding !== prevState.imageUnderstanding ||
    state.voiceGeneration !== prevState.voiceGeneration ||
    state.toolPromptPreferences !== prevState.toolPromptPreferences ||
    state.taskModeEnabled !== prevState.taskModeEnabled ||
    state.mcpServers !== prevState.mcpServers ||
    state.mcpToolTimeoutSeconds !== prevState.mcpToolTimeoutSeconds ||
    state.companionHost !== prevState.companionHost ||
    state.companionConnections !== prevState.companionConnections ||
    state.triggerRules !== prevState.triggerRules
  );
}

export function shouldPersistCollectionState(state: CollectionPersistSnapshot, prevState: CollectionPersistSnapshot) {
  return isSettledHydrationChange(state, prevState) && (
    state.cards !== prevState.cards ||
    state.projectFiles !== prevState.projectFiles ||
    state.workspaceReferenceDocs !== prevState.workspaceReferenceDocs ||
    state.roomProjects !== prevState.roomProjects ||
    state.imageCards !== prevState.imageCards
  );
}

export function shouldPersistSpaceThemeState(state: SpaceThemePersistSnapshot, prevState: SpaceThemePersistSnapshot) {
  return (
    state.theme !== prevState.theme ||
    state.customization !== prevState.customization ||
    state.collaboratorThemes !== prevState.collaboratorThemes
  );
}

export function shouldPersistSpaceState(state: SpacePersistSnapshot, prevState: SpacePersistSnapshot) {
  return shouldPersistSpaceThemeState(state, prevState) || (
    state.activeWorld !== prevState.activeWorld ||
    state.collectionShelf !== prevState.collectionShelf ||
    state.frontstageCollaboratorId !== prevState.frontstageCollaboratorId ||
    state.collectionProjectId !== prevState.collectionProjectId ||
    state.editingCollaboratorId !== prevState.editingCollaboratorId ||
    state.screenshotDebugOverlayEnabled !== prevState.screenshotDebugOverlayEnabled ||
    state.displayPreferences !== prevState.displayPreferences ||
    state.activeCardId !== prevState.activeCardId
  );
}

export function shouldFlushSpaceThemeStateImmediately(
  state: SpaceThemePersistSnapshot,
  prevState: SpaceThemePersistSnapshot
) {
  return (
    shouldPersistSpaceThemeState(state, prevState)
    && state.activeThemePreview === null
    && prevState.activeThemePreview !== null
  );
}

export function createLifecyclePersistenceFlush(
  flushers: Array<() => Promise<unknown>>,
  reportError: (error: unknown) => void = (error) => {
    reportPersistenceError({ label: '[store:persist:lifecycle]', store: 'lifecycle', operation: 'flush' }, error);
  }
) {
  let pendingFlush: Promise<void> | null = null;

  return () => {
    if (pendingFlush) return pendingFlush;

    pendingFlush = Promise.all(flushers.map(async (flush) => {
      await flush();
    }))
      .then(() => undefined)
      .catch((error) => {
        reportError(error);
      })
      .finally(() => {
        pendingFlush = null;
      });

    return pendingFlush;
  };
}

export function usePersistentStoreFlush(spaceThemeHydratedRef: MutableRefObject<boolean>) {
  useEffect(() => {
    const chatPersist = createPersistScheduler(() => useChatStore.getState().persistToDb());
    const personaPersist = createPersistScheduler(() => usePersonaStore.getState().persistToDb());
    const runtimePersist = createPersistScheduler(() => useRuntimeStore.getState().persistToDb());
    const collectionPersist = createPersistScheduler(() => useCollectionStore.getState().persistToDb());
    const spaceThemePersist = createPersistScheduler(() =>
      spaceThemeHydratedRef.current ? writePersistedSpaceThemeState(useSpaceStore.getState()) : Promise.resolve()
    );
    const flushPendingPersistence = createLifecyclePersistenceFlush([
      () =>
        flushPersistSchedulerIfHydrated(useChatStore.getState(), chatPersist),
      () =>
        flushPersistSchedulerIfHydrated(usePersonaStore.getState(), personaPersist),
      () =>
        flushPersistSchedulerIfHydrated(useRuntimeStore.getState(), runtimePersist),
      () =>
        flushPersistSchedulerIfHydrated(useCollectionStore.getState(), collectionPersist),
      () =>
        flushPersistSchedulerIfHydrated({ hydrated: spaceThemeHydratedRef.current }, spaceThemePersist),
      () =>
        flushAllRoomStates()
    ]);

    const unsubscribeChat = useChatStore.subscribe((state, prevState) => {
      if (shouldPersistChatState(state, prevState)) {
        chatPersist.schedule();
      }
    });

    const unsubscribePersona = usePersonaStore.subscribe((state, prevState) => {
      if (shouldPersistPersonaState(state, prevState)) {
        personaPersist.schedule();
      }
    });

    const unsubscribeRuntime = useRuntimeStore.subscribe((state, prevState) => {
      if (shouldPersistRuntimeState(state, prevState)) {
        runtimePersist.schedule();
      }
    });

    const unsubscribeCollection = useCollectionStore.subscribe((state, prevState) => {
      if (shouldPersistCollectionState(state, prevState)) {
        collectionPersist.schedule();
      }
    });

    const unsubscribeSpaceTheme = useSpaceStore.subscribe((state, prevState) => {
      if (shouldPersistSpaceState(state, prevState)) {
        if (shouldFlushSpaceThemeStateImmediately(state, prevState)) {
          void spaceThemePersist.flush().catch((error) => {
            reportPersistenceError({ label: '[space:persist]', store: 'space', operation: 'flush-theme' }, error);
          });
        } else {
          spaceThemePersist.schedule();
        }
      }
    });

    const unregisterLifecycleFlush = registerPageLifecycleFlush(flushPendingPersistence);
    let nativeListenerDisposed = false;
    let removeNativeAppStateListener: (() => void) | null = null;
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')) {
      void CapacitorApp.addListener('appStateChange', () => {
        void flushPendingPersistence();
      }).then((listener) => {
        if (nativeListenerDisposed) {
          void listener.remove();
          return;
        }
        removeNativeAppStateListener = () => {
          void listener.remove();
        };
      }).catch((error) => {
        reportPersistenceError({ label: '[store:persist:lifecycle]', store: 'lifecycle', operation: 'native-listener' }, error);
      });
    }

    return () => {
      nativeListenerDisposed = true;
      removeNativeAppStateListener?.();
      unregisterLifecycleFlush();
      unsubscribeChat();
      unsubscribePersona();
      unsubscribeRuntime();
      unsubscribeCollection();
      unsubscribeSpaceTheme();
      chatPersist.cleanup();
      personaPersist.cleanup();
      runtimePersist.cleanup();
      collectionPersist.cleanup();
      spaceThemePersist.cleanup();
    };
  }, [spaceThemeHydratedRef]);
}
