import { useEffect, useMemo, useRef } from 'react';
import { resolveMcpToolCatalog } from '../engines/mcpRuntime';
import { useRuntimeStore } from '../stores/runtimeStore';

const MCP_CATALOG_HEARTBEAT_INTERVAL_MS = 12_000;

type UseMcpCatalogHeartbeatOptions = {
  enabled?: boolean;
};

export function useMcpCatalogHeartbeat({ enabled = true }: UseMcpCatalogHeartbeatOptions = {}) {
  const hydrated = useRuntimeStore((state) => state.hydrated);
  const mcpServers = useRuntimeStore((state) => state.mcpServers);
  const mcpToolTimeoutSeconds = useRuntimeStore((state) => state.mcpToolTimeoutSeconds);
  const inFlightRef = useRef(false);
  const heartbeatKey = useMemo(
    () => mcpServers
      .map((server) => [
        server.id,
        server.handle,
        server.transport,
        server.url,
        server.isActive ? 'on' : 'off',
        server.headers.map((header) => `${header.key}:${header.value}`).join('\u001f')
      ].join('\u001f'))
      .join('\u001e'),
    [mcpServers]
  );

  useEffect(() => {
    if (!enabled) return;
    if (!hydrated || typeof window === 'undefined') return;
    const activeServers = mcpServers.filter((server) => server.isActive && server.url.trim());
    if (!activeServers.length) return;
    let cancelled = false;

    const refreshCatalog = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await resolveMcpToolCatalog({
          servers: activeServers,
          timeoutSeconds: mcpToolTimeoutSeconds
        });
      } finally {
        inFlightRef.current = false;
      }
    };

    void refreshCatalog().catch(() => {
      // Catalog failures are surfaced on the next chat request through MCP status context.
    });
    const intervalId = window.setInterval(() => {
      if (cancelled) return;
      void refreshCatalog().catch(() => {
        // Keep heartbeat silent; request-time MCP status remains the user-visible evidence.
      });
    }, MCP_CATALOG_HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, hydrated, heartbeatKey, mcpServers, mcpToolTimeoutSeconds]);
}
