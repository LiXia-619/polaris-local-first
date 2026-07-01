function tryParseJson(input: string) {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

function normalizePayloadLine(line: string): string | null {
  if (!line) return null;
  if (line.startsWith(':')) return null;
  if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) return null;
  if (line.startsWith('data:')) return line.slice(5).trimStart();
  return line;
}

function isDoneMarker(input: string) {
  const trimmed = input.trim();
  return trimmed === '[DONE]' || trimmed === 'DONE' || trimmed === 'data: [DONE]';
}

export function createStreamLineParser(onPayload: (payloadText: string) => boolean) {
  let chunkBuffer = '';
  let pendingPayload = '';
  let streamEnded = false;

  const flushPendingPayload = () => {
    const nextPayload = pendingPayload.trim();
    pendingPayload = '';
    if (!nextPayload || streamEnded) return;
    streamEnded = onPayload(nextPayload);
  };

  const consumePayloadLine = (line: string) => {
    if (streamEnded) return;
    const normalized = normalizePayloadLine(line);
    if (normalized == null) return;
    if (!normalized.trim()) {
      flushPendingPayload();
      return;
    }

    pendingPayload = pendingPayload ? `${pendingPayload}\n${normalized}` : normalized;
    if (isDoneMarker(normalized) || tryParseJson(pendingPayload.trim())) {
      flushPendingPayload();
    }
  };

  const pushChunk = (chunk: string) => {
    if (!chunk || streamEnded) return;
    chunkBuffer += chunk;

    let newlineIndex = chunkBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const rawLine = chunkBuffer.slice(0, newlineIndex);
      chunkBuffer = chunkBuffer.slice(newlineIndex + 1);
      consumePayloadLine(rawLine.replace(/\r$/, ''));
      if (streamEnded) break;
      newlineIndex = chunkBuffer.indexOf('\n');
    }
  };

  const finish = () => {
    if (chunkBuffer.trim()) {
      consumePayloadLine(chunkBuffer.replace(/\r$/, ''));
      chunkBuffer = '';
    }
    flushPendingPayload();
  };

  return {
    pushChunk,
    finish
  };
}
