import { beforeEach, describe, expect, it } from 'vitest';
import { useRuntimeStore } from './runtimeStore';

describe('runtimeStore companion connections', () => {
  beforeEach(() => {
    useRuntimeStore.setState(useRuntimeStore.getInitialState(), true);
  });

  it('does not replace companion connection state when a patch changes nothing', () => {
    const connectionId = useRuntimeStore.getState().addCompanionConnection({
      id: 'companion-1',
      collaboratorId: 'companion:one',
      conversationId: 'conversation-1',
      relayUrl: 'http://192.168.0.108:8787',
      hostId: 'host-1',
      clientId: 'client-1',
      clientSecret: 'secret-1',
      lastError: 'Load failed'
    });
    const beforeConnections = useRuntimeStore.getState().companionConnections;

    useRuntimeStore.getState().updateCompanionConnection(connectionId, {
      lastError: 'Load failed'
    });

    expect(useRuntimeStore.getState().companionConnections).toBe(beforeConnections);
  });

  it('replaces companion connection state when a real field changes', () => {
    const connectionId = useRuntimeStore.getState().addCompanionConnection({
      id: 'companion-1',
      collaboratorId: 'companion:one',
      conversationId: 'conversation-1',
      relayUrl: 'http://192.168.0.108:8787',
      hostId: 'host-1',
      clientId: 'client-1',
      clientSecret: 'secret-1',
      lastError: 'Load failed'
    });
    const beforeConnections = useRuntimeStore.getState().companionConnections;

    useRuntimeStore.getState().updateCompanionConnection(connectionId, {
      lastError: 'Failed to fetch'
    });

    expect(useRuntimeStore.getState().companionConnections).not.toBe(beforeConnections);
    expect(useRuntimeStore.getState().companionConnections[0]?.lastError).toBe('Failed to fetch');
  });
});
