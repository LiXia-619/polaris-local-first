export function isAbortError(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'name' in error
    && (error as { name?: unknown }).name === 'AbortError'
  );
}

export function createAbortError(message = 'Aborted') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function throwIfAborted(signal?: AbortSignal | null) {
  if (!signal?.aborted) return;
  throw createAbortError();
}
