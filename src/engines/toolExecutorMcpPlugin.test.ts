import { describe, expect, it, vi } from 'vitest';
import { mcpToolExecutorPlugin } from './toolExecutorMcpPlugin';
import type { ToolContext } from './toolExecutorTypes';
import type { ChatAttachment } from '../types/domain';

function createImageAttachment(seed: Partial<ChatAttachment> = {}): ChatAttachment {
  return {
    id: seed.id ?? 'attachment-image-1',
    assetId: seed.assetId ?? 'asset-image-1',
    kind: 'image',
    name: seed.name ?? 'take_screenshot-1.png',
    mimeType: seed.mimeType ?? 'image/png',
    size: seed.size ?? 128
  };
}

function createContext(overrides: Partial<ToolContext> = {}) {
  return {
    invokeMcpTool: vi.fn(async () => ({
      ok: true as const,
      detailText: 'weather: sunny',
      attachments: [createImageAttachment()],
      structuredContent: {
        forecastId: 8891
      }
    })),
    ...overrides
  } as ToolContext;
}

describe('mcpToolExecutorPlugin', () => {
  it('returns MCP tool output when invocation succeeds', async () => {
    const ctx = createContext();

    const result = await mcpToolExecutorPlugin.execute({
      kind: 'invokeMcpTool',
      serverId: 'server-1',
      serverName: 'Weather MCP',
      schemaName: 'mcp__weather__get_weather',
      toolName: 'get_weather',
      argumentsObject: {
        city: 'Shanghai'
      },
      targetLabel: 'Weather MCP / get_weather'
    }, ctx);

    expect(result).toEqual({
      ok: true,
      summary: '已调用 MCP 工具 · Weather MCP / get_weather',
      detailText: 'weather: sunny',
      attachments: [createImageAttachment()],
      mcpResult: {
        serverId: 'server-1',
        serverName: 'Weather MCP',
        schemaName: 'mcp__weather__get_weather',
        toolName: 'get_weather',
        argumentsObject: {
          city: 'Shanghai'
        },
        structuredContent: {
          forecastId: 8891
        }
      }
    });
    expect(ctx.invokeMcpTool).toHaveBeenCalledWith('server-1', 'get_weather', {
      city: 'Shanghai'
    });
  });

  it('uses the tool name in the summary when target label is absent', async () => {
    const ctx = createContext();

    const result = await mcpToolExecutorPlugin.execute({
      kind: 'invokeMcpTool',
      serverId: 'server-1',
      serverName: 'Weather MCP',
      toolName: 'get_weather',
      argumentsObject: {}
    }, ctx);

    expect(result).toMatchObject({
      ok: true,
      summary: '已调用 MCP 工具 · get_weather'
    });
  });

  it('passes through MCP invocation failures', async () => {
    const ctx = createContext({
      invokeMcpTool: vi.fn(async () => ({
        ok: false as const,
        error: 'MCP 连接失败'
      }))
    });

    const result = await mcpToolExecutorPlugin.execute({
      kind: 'invokeMcpTool',
      serverId: 'server-1',
      serverName: 'Weather MCP',
      toolName: 'get_weather',
      argumentsObject: {}
    }, ctx);

    expect(result).toEqual({
      ok: false,
      error: 'MCP 连接失败'
    });
  });

  it('keeps MCP business errors as structured tool results', async () => {
    const ctx = createContext({
      invokeMcpTool: vi.fn(async () => ({
        ok: true as const,
        detailText: 'Permission denied',
        isError: true,
        structuredContent: {
          code: 'permission_denied'
        }
      }))
    });

    const result = await mcpToolExecutorPlugin.execute({
      kind: 'invokeMcpTool',
      serverId: 'server-1',
      serverName: 'Docs MCP',
      schemaName: 'mcp__docs__delete_doc',
      toolName: 'delete_doc',
      argumentsObject: {
        id: 'doc-1'
      }
    }, ctx);

    expect(result).toEqual({
      ok: true,
      summary: 'MCP 工具返回错误 · delete_doc',
      detailText: 'Permission denied',
      attachments: undefined,
      mcpResult: {
        serverId: 'server-1',
        serverName: 'Docs MCP',
        schemaName: 'mcp__docs__delete_doc',
        toolName: 'delete_doc',
        argumentsObject: {
          id: 'doc-1'
        },
        isError: true,
        structuredContent: {
          code: 'permission_denied'
        }
      }
    });
  });
});
