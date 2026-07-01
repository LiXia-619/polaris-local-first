export type ToolResult<T extends object = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
