import { kvGet, kvSet } from '../infrastructure/persistence';
import { reportPersistenceError } from '../infrastructure/persistenceDiagnostics';

export type RoomStateSnapshot = Record<string, unknown>;

const ROOM_STATE_KEY_PREFIX = 'room-state:';

function normalizeRoomState(value: unknown): RoomStateSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as RoomStateSnapshot;
}

export function buildRoomStateStorageKey(cardId: string) {
  return `${ROOM_STATE_KEY_PREFIX}${cardId}`;
}

export async function readRoomState(cardId: string) {
  return normalizeRoomState(await kvGet<unknown>(buildRoomStateStorageKey(cardId)));
}

export async function writeRoomState(cardId: string, state: unknown) {
  await kvSet(buildRoomStateStorageKey(cardId), normalizeRoomState(state));
}

function reportRoomStatePersistenceError(operation: string, error: unknown) {
  reportPersistenceError({ label: '[room-state:persist]', store: 'room-state', operation }, error);
}

type RoomStateListener = (state: RoomStateSnapshot) => void;

const roomStateCache = new Map<string, RoomStateSnapshot>();
const roomStateLoaders = new Map<string, Promise<RoomStateSnapshot>>();
const roomStateListeners = new Map<string, Set<RoomStateListener>>();
const roomStatePersistTimers = new Map<string, number>();

function emitRoomState(cardId: string) {
  const snapshot = roomStateCache.get(cardId) ?? {};
  roomStateListeners.get(cardId)?.forEach((listener) => listener(snapshot));
}

function scheduleRoomStatePersist(cardId: string) {
  if (typeof window === 'undefined') {
    void writeRoomState(cardId, roomStateCache.get(cardId) ?? {}).catch((error) => {
      reportRoomStatePersistenceError('debounced-write', error);
    });
    return;
  }

  const existingTimer = roomStatePersistTimers.get(cardId);
  if (existingTimer !== undefined) {
    window.clearTimeout(existingTimer);
  }

  roomStatePersistTimers.set(
    cardId,
    window.setTimeout(() => {
      roomStatePersistTimers.delete(cardId);
      void writeRoomState(cardId, roomStateCache.get(cardId) ?? {}).catch((error) => {
        reportRoomStatePersistenceError('debounced-write', error);
      });
    }, 120)
  );
}

async function flushRoomStatePersist(cardId: string) {
  const existingTimer = roomStatePersistTimers.get(cardId);
  if (typeof window !== 'undefined' && existingTimer !== undefined) {
    window.clearTimeout(existingTimer);
  }
  roomStatePersistTimers.delete(cardId);
  try {
    await writeRoomState(cardId, roomStateCache.get(cardId) ?? {});
  } catch (error) {
    reportRoomStatePersistenceError('flush', error);
  }
}

export function getCachedRoomState(cardId: string) {
  return roomStateCache.get(cardId) ?? {};
}

export async function ensureRoomState(cardId: string) {
  const cached = roomStateCache.get(cardId);
  if (cached) return cached;

  const pending = roomStateLoaders.get(cardId);
  if (pending) return await pending;

  const loader = readRoomState(cardId)
    .then((state) => {
      if (!roomStateCache.has(cardId)) {
        roomStateCache.set(cardId, state);
      }
      emitRoomState(cardId);
      return roomStateCache.get(cardId) ?? state;
    })
    .finally(() => {
      roomStateLoaders.delete(cardId);
    });

  roomStateLoaders.set(cardId, loader);
  return await loader;
}

export function updateRoomState(cardId: string, state: unknown) {
  roomStateCache.set(cardId, normalizeRoomState(state));
  emitRoomState(cardId);
  scheduleRoomStatePersist(cardId);
}

export async function flushRoomState(cardId: string) {
  await flushRoomStatePersist(cardId);
}

export async function flushAllRoomStates() {
  await Promise.all(
    [...roomStatePersistTimers.keys()].map(async (cardId) => {
      await flushRoomStatePersist(cardId);
    })
  );
}

export function subscribeRoomState(cardId: string, listener: RoomStateListener) {
  const listeners = roomStateListeners.get(cardId) ?? new Set<RoomStateListener>();
  listeners.add(listener);
  roomStateListeners.set(cardId, listeners);
  listener(getCachedRoomState(cardId));

  return () => {
    const current = roomStateListeners.get(cardId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      roomStateListeners.delete(cardId);
    }
  };
}
