import { describe, expect, it, vi } from 'vitest';
import { executeToolActionWithPlugins, type ToolExecutorPlugin } from './toolExecutorPlugins';
import type { ToolAction, ToolContext } from './toolExecutorTypes';

const action = { kind: 'switchWorld', world: 'chat' } satisfies ToolAction;
const context = {} as ToolContext;

describe('executeToolActionWithPlugins', () => {
  it('delegates to the manifest-owned plugin for the action kind', async () => {
    const skipped = {
      name: 'theme',
      canHandle: vi.fn(() => true),
      execute: vi.fn()
    } satisfies ToolExecutorPlugin;
    const handler = {
      name: 'app',
      canHandle: vi.fn(() => true),
      execute: vi.fn(async () => ({ ok: true as const, summary: 'handled' }))
    } satisfies ToolExecutorPlugin;

    const result = await executeToolActionWithPlugins(action, context, [skipped, handler]);

    expect(result).toEqual({ ok: true, summary: 'handled' });
    expect(skipped.canHandle).not.toHaveBeenCalled();
    expect(skipped.execute).not.toHaveBeenCalled();
    expect(handler.canHandle).toHaveBeenCalledWith(action);
    expect(handler.execute).toHaveBeenCalledWith(action, context);
  });

  it('returns a failed result when no plugin can handle the action', async () => {
    const result = await executeToolActionWithPlugins(action, context, []);

    expect(result).toEqual({
      ok: false,
      error: '没有找到可执行工具：switchWorld'
    });
  });

  it('normalizes thrown executor errors into failed tool results', async () => {
    const handler = {
      name: 'app',
      canHandle: () => true,
      execute: async () => {
        throw new Error('Boom');
      }
    } satisfies ToolExecutorPlugin;

    const result = await executeToolActionWithPlugins(action, context, [handler]);

    expect(result).toEqual({
      ok: false,
      error: 'Boom'
    });
  });
});
