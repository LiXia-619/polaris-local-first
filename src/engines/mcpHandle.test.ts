import { describe, expect, it } from 'vitest';
import { buildMcpHandle } from './mcpHandle';

describe('buildMcpHandle', () => {
  it('builds stable handles from names', () => {
    expect(buildMcpHandle({ name: '@kelivo/fetch' })).toBe('kelivo_fetch');
    expect(buildMcpHandle({ name: 'My MCP' })).toBe('my_mcp');
  });
});
