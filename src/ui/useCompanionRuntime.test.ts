import { describe, expect, it } from 'vitest';
import type { PolarisCompanionConnection } from '../types/domain';
import { resolveCompanionConnectionSyncKey } from './useCompanionRuntime';

function createConnection(patch: Partial<PolarisCompanionConnection> = {}): PolarisCompanionConnection {
  return {
    id: 'companion-1',
    source: 'polaris',
    collaboratorId: 'companion:one',
    conversationId: 'conversation-1',
    relayUrl: 'http://192.168.0.108:8787',
    hostId: 'host-1',
    clientId: 'client-1',
    clientSecret: 'secret-1',
    label: '电脑端',
    hostLabel: '这台 Polaris',
    pushToken: null,
    pushPlatform: null,
    remoteThreadId: null,
    createdAt: 1000,
    lastSnapshotAt: null,
    lastError: null,
    ...patch
  };
}

describe('resolveCompanionConnectionSyncKey', () => {
  it('ignores runtime result fields that should not restart polling', () => {
    const baseKey = resolveCompanionConnectionSyncKey([
      createConnection({
        lastError: null,
        lastSnapshotAt: 1000,
        remoteThreadId: 'remote-1'
      })
    ]);
    const resultKey = resolveCompanionConnectionSyncKey([
      createConnection({
        lastError: 'Load failed',
        lastSnapshotAt: 2000,
        remoteThreadId: 'remote-2'
      })
    ]);

    expect(resultKey).toBe(baseKey);
  });

  it('changes when the connection target changes', () => {
    const baseKey = resolveCompanionConnectionSyncKey([createConnection()]);
    const targetKey = resolveCompanionConnectionSyncKey([
      createConnection({
        relayUrl: 'http://127.0.0.1:8787'
      })
    ]);

    expect(targetKey).not.toBe(baseKey);
  });
});
