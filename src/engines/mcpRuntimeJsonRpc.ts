// JSON-RPC 2.0 message shaping and validation for the MCP runtime.
//
// Pure protocol layer: the message types, request-id generation, and the
// helpers that pick a response out of a (possibly batched) payload and assert
// it succeeded. No transport, no I/O — the HTTP and SSE layers in mcpRuntime.ts
// produce raw payloads and use these to interpret them.

export type JsonRpcId = string | number;

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcMessage = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

export function createRpcId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function parseJsonRpcMessage(value: unknown): JsonRpcMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonRpcMessage;
}

export function findResponseMessage(payload: unknown, expectedId: JsonRpcId): JsonRpcMessage | null {
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const next = findResponseMessage(entry, expectedId);
      if (next) return next;
    }
    return null;
  }

  const message = parseJsonRpcMessage(payload);
  if (!message) return null;
  if (message.id !== expectedId) return null;
  return message;
}

export function ensureSuccessMessage(message: JsonRpcMessage | null, label: string) {
  if (!message) {
    throw new Error(`${label} 没有返回有效响应。`);
  }
  if (message.error) {
    throw new Error(`${label} 失败：${message.error.message || '未知错误'}`);
  }
  return message;
}
