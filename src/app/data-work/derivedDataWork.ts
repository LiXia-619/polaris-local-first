import { readCompleteLiveChatState } from '../../stores/chatCurrentPersistence';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePersonaStore } from '../../stores/personaStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import type { Conversation } from '../../types/domain';

export type DerivedDataWorkKind =
  | 'conversation_summary'
  | 'memory_vector_index'
  | 'asset_audit';

export type DerivedDataWorkPriority = 'foreground' | 'background';

export type DerivedDataWorkSnapshot = {
  chatHydrated: boolean;
  personaHydrated: boolean;
  runtimeHydrated: boolean;
  collectionHydrated: boolean;
  dirtyConversationCount: number;
  deletedConversationCount: number;
  loadingConversationCount: number;
};

export type DerivedDataWorkRunContext = {
  signal: AbortSignal;
  yieldToForeground: () => Promise<void>;
};

export type RunDerivedDataWorkOptions<T> = {
  id?: string;
  kind: DerivedDataWorkKind;
  priority?: DerivedDataWorkPriority;
  signal?: AbortSignal;
  yieldToForeground?: () => Promise<void>;
  run: (context: DerivedDataWorkRunContext) => Promise<T>;
};

type DerivedDataWorkQueueItem = {
  id: string;
  kind: DerivedDataWorkKind;
  priority: DerivedDataWorkPriority;
  controller: AbortController;
  yieldToForeground: () => Promise<void>;
  run: (context: DerivedDataWorkRunContext) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

let queue: DerivedDataWorkQueueItem[] = [];
let activeItem: DerivedDataWorkQueueItem | null = null;
let paused = false;
let nextWorkId = 1;

export function readDerivedDataWorkSnapshot(): DerivedDataWorkSnapshot {
  const chat = useChatStore.getState();
  return {
    chatHydrated: chat.hydrated,
    personaHydrated: usePersonaStore.getState().hydrated,
    runtimeHydrated: useRuntimeStore.getState().hydrated,
    collectionHydrated: useCollectionStore.getState().hydrated,
    dirtyConversationCount: chat.dirtyConversationIds.length,
    deletedConversationCount: chat.deletedConversationIds.length,
    loadingConversationCount: chat.loadingMessageConversationIds.length
  };
}

export function assertDerivedDataWorkCanStart(
  _kind: DerivedDataWorkKind,
  snapshot: DerivedDataWorkSnapshot = readDerivedDataWorkSnapshot()
) {
  if (
    !snapshot.chatHydrated
    || !snapshot.personaHydrated
    || !snapshot.runtimeHydrated
    || !snapshot.collectionHydrated
  ) {
    throw new Error('本地数据还在载入，稍后再整理派生数据。');
  }

  if (snapshot.dirtyConversationCount > 0 || snapshot.deletedConversationCount > 0) {
    throw new Error('对话还有未落盘更改，等自动保存完成后再整理派生数据。');
  }

  if (snapshot.loadingConversationCount > 0) {
    throw new Error('对话正文还在读取，等加载完成后再整理派生数据。');
  }
}

export async function readStableCompleteChatConversationsForDerivedDataWork(
  kind: DerivedDataWorkKind
): Promise<Conversation[]> {
  assertDerivedDataWorkCanStart(kind);
  const payload = await readCompleteLiveChatState();
  if (!payload) return [];

  if (
    payload.shouldCommitSnapshot
    || (payload.recoveredConversationIds?.length ?? 0) > 0
    || (payload.prunedConversationIds?.length ?? 0) > 0
    || (payload.quarantinedConversationIds?.length ?? 0) > 0
  ) {
    throw new Error('本地对话还在恢复整理，等恢复写回完成后再整理派生数据。');
  }

  return payload.conversations;
}

async function defaultYieldToForeground() {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

function makeAbortError(kind: DerivedDataWorkKind) {
  return new Error(`${kind} 派生任务已取消。`);
}

function makeGenericAbortError() {
  return new Error('派生任务已取消。');
}

function insertQueueItem(item: DerivedDataWorkQueueItem) {
  if (item.priority === 'foreground') {
    const firstBackgroundIndex = queue.findIndex((queued) => queued.priority === 'background');
    if (firstBackgroundIndex >= 0) {
      queue.splice(firstBackgroundIndex, 0, item);
      return;
    }
  }

  queue.push(item);
}

function removeQueuedItem(item: DerivedDataWorkQueueItem) {
  const queuedIndex = queue.indexOf(item);
  if (queuedIndex < 0) return false;
  queue.splice(queuedIndex, 1);
  return true;
}

function pumpDerivedDataWorkQueue() {
  if (paused || activeItem || queue.length === 0) return;

  const item = queue.shift() ?? null;
  if (!item) return;
  activeItem = item;

  void (async () => {
    try {
      if (item.controller.signal.aborted) {
        throw item.controller.signal.reason ?? makeAbortError(item.kind);
      }
      assertDerivedDataWorkCanStart(item.kind);
      await item.yieldToForeground();
      const result = await item.run({
        signal: item.controller.signal,
        yieldToForeground: item.yieldToForeground
      });
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      if (activeItem === item) activeItem = null;
      pumpDerivedDataWorkQueue();
    }
  })();
}

export function runDerivedDataWork<T>(options: RunDerivedDataWorkOptions<T>): Promise<T> {
  const controller = new AbortController();
  const signal = options.signal;

  return new Promise<T>((resolve, reject) => {
    let item: DerivedDataWorkQueueItem;
    const abortFromCaller = () => {
      const reason = signal?.reason ?? makeAbortError(options.kind);
      controller.abort(reason);
      if (removeQueuedItem(item)) {
        item.reject(reason);
      }
    };

    signal?.addEventListener('abort', abortFromCaller, { once: true });

    item = {
      id: options.id ?? `${options.kind}:${nextWorkId++}`,
      kind: options.kind,
      priority: options.priority ?? 'background',
      controller,
      yieldToForeground: options.yieldToForeground ?? defaultYieldToForeground,
      run: options.run,
      resolve: (value) => {
        signal?.removeEventListener('abort', abortFromCaller);
        resolve(value as T);
      },
      reject: (reason) => {
        signal?.removeEventListener('abort', abortFromCaller);
        reject(reason);
      }
    };

    if (signal?.aborted) {
      abortFromCaller();
      return;
    }

    if (controller.signal.aborted) {
      item.reject(controller.signal.reason ?? makeAbortError(options.kind));
      return;
    }

    insertQueueItem(item);
    pumpDerivedDataWorkQueue();
  });
}

export function pauseDerivedDataWorkQueue() {
  paused = true;
}

export function resumeDerivedDataWorkQueue() {
  paused = false;
  pumpDerivedDataWorkQueue();
}

export function cancelDerivedDataWork(id: string, reason: unknown = makeGenericAbortError()) {
  if (activeItem?.id === id) {
    activeItem.controller.abort(reason);
    return true;
  }

  const queuedIndex = queue.findIndex((item) => item.id === id);
  if (queuedIndex < 0) return false;
  const [item] = queue.splice(queuedIndex, 1);
  item?.reject(reason);
  return true;
}

export function cancelAllDerivedDataWork(reason: unknown = makeGenericAbortError()) {
  activeItem?.controller.abort(reason);
  const queuedItems = queue;
  queue = [];
  queuedItems.forEach((item) => item.reject(reason));
}
