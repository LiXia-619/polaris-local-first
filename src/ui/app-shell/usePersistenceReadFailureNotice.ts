import { useEffect, useMemo, useState } from 'react';
import {
  readLatestPersistenceError,
  subscribeLatestPersistenceError,
  type PersistenceDiagnosticEntry
} from '../../infrastructure/persistenceDiagnostics';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePersonaStore } from '../../stores/personaStore';
import { useRuntimeStore } from '../../stores/runtimeStore';

export type PersistenceReadFailureNoticeState = {
  visible: boolean;
  error: PersistenceDiagnosticEntry | null;
  blockedStores: string[];
  reason: 'read-failure' | null;
};

export type PersistenceReadFailureHydrationState = {
  startupReady: boolean;
  chatHydrated: boolean;
  collectionHydrated: boolean;
  personaHydrated: boolean;
  runtimeHydrated: boolean;
};

function isCoreHydrationReadFailure(error: PersistenceDiagnosticEntry | null) {
  if (!error) return false;
  return (
    ['chat', 'collection', 'persona', 'runtime'].includes(error.store) &&
    error.operation.startsWith('read')
  );
}

export function derivePersistenceReadFailureNotice(
  error: PersistenceDiagnosticEntry | null,
  hydration: PersistenceReadFailureHydrationState
): PersistenceReadFailureNoticeState {
  const blockedStores = [
    !hydration.chatHydrated ? '对话' : null,
    !hydration.collectionHydrated ? '房间' : null,
    !hydration.personaHydrated ? '协作者' : null,
    !hydration.runtimeHydrated ? '设置' : null
  ].filter((item): item is string => Boolean(item));

  return {
    visible: Boolean(blockedStores.length > 0 && hydration.startupReady && isCoreHydrationReadFailure(error)),
    error,
    blockedStores,
    reason: isCoreHydrationReadFailure(error) ? 'read-failure' : null
  };
}

export function usePersistenceReadFailureNotice(startupReady: boolean): PersistenceReadFailureNoticeState {
  const chatHydrated = useChatStore((state) => state.hydrated);
  const collectionHydrated = useCollectionStore((state) => state.hydrated);
  const personaHydrated = usePersonaStore((state) => state.hydrated);
  const runtimeHydrated = useRuntimeStore((state) => state.hydrated);
  const [error, setError] = useState<PersistenceDiagnosticEntry | null>(() => readLatestPersistenceError());

  useEffect(() => subscribeLatestPersistenceError(setError), []);

  return useMemo(
    () => derivePersistenceReadFailureNotice(error, {
      startupReady,
      chatHydrated,
      collectionHydrated,
      personaHydrated,
      runtimeHydrated
    }),
    [chatHydrated, collectionHydrated, error, personaHydrated, runtimeHydrated, startupReady]
  );
}
