import { reportPersistenceError } from '../infrastructure/persistenceDiagnostics';
import type { ChatStoreGet } from './chatStoreTypes';

export function flushChatPersistenceIfHydrated(getState: ChatStoreGet, operation: string) {
  const state = getState();
  if (!state.hydrated) return;
  void state.persistToDb().catch((error) => {
    reportPersistenceError({ label: '[store:persist]', store: 'chat', operation }, error);
  });
}
