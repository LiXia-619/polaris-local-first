type PageLifecycleFlushHandler = () => void | Promise<void>;

const flushHandlers = new Set<PageLifecycleFlushHandler>();
let lifecycleListenersInstalled = false;

export async function flushPageLifecycleHandlers() {
  await Promise.all([...flushHandlers].map(async (handler) => {
    await handler();
  }));
}

function handleVisibilityChange() {
  void flushPageLifecycleHandlers().catch((error) => {
    console.warn('[page-lifecycle:flush]', error);
  });
}

function handlePageHide() {
  void flushPageLifecycleHandlers().catch((error) => {
    console.warn('[page-lifecycle:flush]', error);
  });
}

function installLifecycleListeners() {
  if (typeof window === 'undefined' || lifecycleListenersInstalled) return;

  window.addEventListener('pagehide', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  lifecycleListenersInstalled = true;
}

function removeLifecycleListenersIfIdle() {
  if (typeof window === 'undefined' || !lifecycleListenersInstalled || flushHandlers.size > 0) return;

  window.removeEventListener('pagehide', handlePageHide);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  lifecycleListenersInstalled = false;
}

export function registerPageLifecycleFlush(handler: PageLifecycleFlushHandler) {
  if (typeof window === 'undefined') return () => {};

  flushHandlers.add(handler);
  installLifecycleListeners();

  return () => {
    flushHandlers.delete(handler);
    removeLifecycleListenersIfIdle();
  };
}
