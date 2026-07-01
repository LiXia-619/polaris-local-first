// Async timing helpers for the MCP runtime.
//
// Pure timer utilities shared by both transports and the catalog retry loop:
// a localized timeout Error, a cancellable sleep, and a promise/timeout race.
// No I/O, no MCP protocol knowledge.

export function createTimeoutError(label: string, timeoutMs: number) {
  return new Error(`${label} 超时（${Math.ceil(timeoutMs / 1000)} 秒）。`);
}

export function wait(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = globalThis.setTimeout(() => {
          reject(createTimeoutError(label, timeoutMs));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}
