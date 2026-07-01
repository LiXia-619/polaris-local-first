export type DebugLog<T> = {
  append: (entry: T) => void;
  appendMany: (entries: T[]) => void;
  read: () => T[];
  clear: () => void;
};

export type DebugLogOptions = {
  maxEntries: number;
  broadcastEvent?: string;
};

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dispatchDebugLogEvent(eventName: string | undefined) {
  if (!eventName || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName));
}

export function createDebugLog<T>(
  storageKey: string,
  options: DebugLogOptions
): DebugLog<T> {
  const read = () => {
    const storage = getLocalStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  };

  const write = (entries: T[]) => {
    const storage = getLocalStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKey, JSON.stringify(entries.slice(-options.maxEntries)));
      dispatchDebugLogEvent(options.broadcastEvent);
    } catch {
      // Ignore storage failures on restrictive webviews.
    }
  };

  return {
    append(entry) {
      write([...read(), entry]);
    },
    appendMany(entries) {
      if (entries.length === 0) return;
      write([...read(), ...entries]);
    },
    read,
    clear() {
      const storage = getLocalStorage();
      if (!storage) return;
      try {
        storage.removeItem(storageKey);
        dispatchDebugLogEvent(options.broadcastEvent);
      } catch {
        // Ignore storage failures on restrictive webviews.
      }
    }
  };
}
