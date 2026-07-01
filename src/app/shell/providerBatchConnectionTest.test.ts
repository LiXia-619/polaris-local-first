import { describe, expect, it, vi } from 'vitest';
import type { ProviderProfile } from '../../types/domain';
import {
  canRunProviderConnectionTest,
  formatProviderBatchConnectionErrorReport,
  runProviderBatchConnectionTest
} from './providerBatchConnectionTest';

function createProvider(patch: Partial<ProviderProfile> = {}): ProviderProfile {
  return {
    id: patch.id ?? 'provider-test',
    name: patch.name ?? '测试供应商',
    protocol: patch.protocol ?? 'openai-completions',
    baseUrl: patch.baseUrl ?? 'https://api.example.test/v1',
    path: patch.path ?? '/chat/completions',
    apiKey: patch.apiKey ?? 'key-test',
    model: patch.model ?? 'test-model',
    capabilities: {
      images: patch.capabilities?.images ?? false,
      streaming: patch.capabilities?.streaming ?? true,
      thinking: patch.capabilities?.thinking ?? false
    }
  };
}

describe('provider batch connection test', () => {
  it('only treats complete provider routes as testable', () => {
    expect(canRunProviderConnectionTest(createProvider())).toBe(true);
    expect(canRunProviderConnectionTest(createProvider({ apiKey: '' }))).toBe(false);
    expect(canRunProviderConnectionTest(createProvider({ baseUrl: '' }))).toBe(false);
    expect(canRunProviderConnectionTest(createProvider({ model: '' }))).toBe(false);
  });

  it('runs testable providers sequentially and reports aggregate state', async () => {
    const providers = [
      createProvider({ id: 'ok', name: '正常', model: 'ok-model' }),
      createProvider({ id: 'missing-key', name: '缺 Key', apiKey: '' }),
      createProvider({ id: 'bad', name: '异常', model: 'bad-model' })
    ];
    const states: string[] = [];
    const tester = vi.fn(async (provider: ProviderProfile) => {
      if (provider.id === 'bad') return { ok: false as const, error: 'HTTP 401 invalid key' };
      return { ok: true as const, message: 'pong' };
    });

    const result = await runProviderBatchConnectionTest({
      providers,
      testProvider: tester,
      onProgress: (state) => {
        states.push(`${state.status}:${state.completed}/${state.total}:${state.passed}/${state.failed}`);
      }
    });

    expect(tester).toHaveBeenCalledTimes(2);
    expect(tester.mock.calls.map((call) => call[0].id)).toEqual(['ok', 'bad']);
    expect(result.status).toBe('error');
    expect(result.total).toBe(2);
    expect(result.completed).toBe(2);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.entries.map((entry) => entry.status)).toEqual(['success', 'error']);
    expect(states).toContain('running:0/2:0/0');
    expect(states).toContain('running:1/2:1/0');
    expect(states).toContain('error:2/2:1/1');
  });

  it('formats failed provider details for copying', async () => {
    const result = await runProviderBatchConnectionTest({
      providers: [createProvider({ id: 'bad', name: '异常线路', model: 'bad-model' })],
      testProvider: async () => ({ ok: false, error: 'API 500 upstream exploded' })
    });

    expect(formatProviderBatchConnectionErrorReport(result)).toContain('异常线路 · bad-model');
    expect(formatProviderBatchConnectionErrorReport(result)).toContain('API 500 upstream exploded');
  });
});
