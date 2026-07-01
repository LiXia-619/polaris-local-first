import { describe, expect, it, vi } from 'vitest';
import { appToolExecutorPlugin } from './toolExecutorAppPlugin';
import type { ToolContext } from './toolExecutorTypes';

describe('appToolExecutorPlugin', () => {
  it('switches the active world', async () => {
    const ctx = {
      setWorld: vi.fn()
    } as unknown as ToolContext;

    const result = await appToolExecutorPlugin.execute({
      kind: 'switchWorld',
      world: 'chat'
    }, ctx);

    expect(result).toEqual({ ok: true });
    expect(ctx.setWorld).toHaveBeenCalledWith('chat');
  });
});
