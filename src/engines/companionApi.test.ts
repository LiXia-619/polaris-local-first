import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCompanionAutomationTriggerUrl,
  resolveCompanionRelayPlaceholder,
  resolveDefaultCompanionRelayUrl
} from './companionApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildCompanionAutomationTriggerUrl', () => {
  it('builds a host-scoped automation relay URL', () => {
    expect(buildCompanionAutomationTriggerUrl({
      relayUrl: 'https://relay.example.com/',
      hostId: 'host-1',
      ruleId: 'trigger-1',
      secret: 'secret-1',
      prompt: '我到家了'
    })).toBe('https://relay.example.com/api/companion/polaris/automation/trigger?hostId=host-1&ruleId=trigger-1&secret=secret-1&prompt=%E6%88%91%E5%88%B0%E5%AE%B6%E4%BA%86');
  });
});

describe('resolveDefaultCompanionRelayUrl', () => {
  it('does not default private companion relay to a hosted web origin', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://polaris.example.com'
      }
    });

    expect(resolveDefaultCompanionRelayUrl()).toBe('');
    expect(resolveCompanionRelayPlaceholder()).toBe('https://your-computer.example.com');
  });

  it('uses the current origin when Polaris is served from a user-owned local relay', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://192.168.1.20:8787'
      }
    });

    expect(resolveDefaultCompanionRelayUrl()).toBe('http://192.168.1.20:8787');
    expect(resolveCompanionRelayPlaceholder()).toBe('http://192.168.1.20:8787');
  });
});
