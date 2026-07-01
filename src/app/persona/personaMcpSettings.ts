import type { McpServerConfig, Persona } from '../../types/domain';

export function resolvePersonaMcpServers(args: {
  persona?: Persona | null;
  mcpServers: McpServerConfig[];
}) {
  const { persona, mcpServers } = args;
  if (!persona || persona.mcp?.inheritGlobal !== false) {
    return mcpServers;
  }

  const selectedServerIds = new Set(persona.mcp.serverIds);
  if (selectedServerIds.size === 0) return [];
  return mcpServers.filter((server) => selectedServerIds.has(server.id));
}
