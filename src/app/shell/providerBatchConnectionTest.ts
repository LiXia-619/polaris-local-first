import { isPolarisBuiltInProvider } from '../../engines/freeProvider';
import type { ProviderProfile } from '../../types/domain';

export type ProviderBatchConnectionTestEntryStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'error';

export type ProviderBatchConnectionTestEntry = {
  providerId: string;
  providerName: string;
  model: string;
  status: ProviderBatchConnectionTestEntryStatus;
  message: string;
};

export type ProviderBatchConnectionTestState = {
  status: 'idle' | 'running' | 'success' | 'error';
  total: number;
  completed: number;
  passed: number;
  failed: number;
  message: string | null;
  entries: ProviderBatchConnectionTestEntry[];
};

export type ProviderConnectionTester = (
  provider: ProviderProfile
) => Promise<{ ok: true; message?: string } | { ok: false; error: string }>;

export type ProviderBatchConnectionTestCopy = {
  missingModel: string;
  queued: string;
  empty: string;
  running: string;
  missingProvider: string;
  connected: string;
  doneWithFailures: (failed: number, passed: number) => string;
  doneSuccess: (passed: number) => string;
  reportTitle: string;
  reportResult: (message: string) => string;
  reportProgress: (state: Pick<ProviderBatchConnectionTestState, 'completed' | 'total' | 'passed' | 'failed'>) => string;
};

export const DEFAULT_PROVIDER_BATCH_CONNECTION_TEST_COPY: ProviderBatchConnectionTestCopy = {
  missingModel: '未填写模型',
  queued: '等待测试',
  empty: '没有可测试的供应商：请先填写 Base URL、API Key 和模型名。',
  running: '正在发送真实 ping 请求',
  missingProvider: '供应商配置已不存在',
  connected: '已连通',
  doneWithFailures: (failed, passed) => `${failed} 条线路异常，${passed} 条正常。`,
  doneSuccess: (passed) => `${passed} 条线路全部正常。`,
  reportTitle: '供应商整体测试失败',
  reportResult: (message) => `结果：${message}`,
  reportProgress: (state) => `进度：${state.completed}/${state.total}，正常 ${state.passed}，异常 ${state.failed}`
};

export const EMPTY_PROVIDER_BATCH_CONNECTION_TEST_STATE: ProviderBatchConnectionTestState = {
  status: 'idle',
  total: 0,
  completed: 0,
  passed: 0,
  failed: 0,
  message: null,
  entries: []
};

export function canRunProviderConnectionTest(provider: ProviderProfile) {
  if (isPolarisBuiltInProvider(provider)) return true;
  return Boolean(provider.baseUrl.trim() && provider.model.trim() && provider.apiKey.trim());
}

function createQueuedEntries(
  providers: ProviderProfile[],
  copy: ProviderBatchConnectionTestCopy
): ProviderBatchConnectionTestEntry[] {
  return providers
    .filter(canRunProviderConnectionTest)
    .map((provider) => ({
      providerId: provider.id,
      providerName: provider.name.trim() || provider.id,
      model: provider.model.trim() || copy.missingModel,
      status: 'queued',
      message: copy.queued
    }));
}

function cloneBatchState(state: ProviderBatchConnectionTestState): ProviderBatchConnectionTestState {
  return {
    ...state,
    entries: state.entries.map((entry) => ({ ...entry }))
  };
}

export async function runProviderBatchConnectionTest({
  providers,
  testProvider,
  onProgress,
  copy = DEFAULT_PROVIDER_BATCH_CONNECTION_TEST_COPY
}: {
  providers: ProviderProfile[];
  testProvider: ProviderConnectionTester;
  onProgress?: (state: ProviderBatchConnectionTestState) => void;
  copy?: ProviderBatchConnectionTestCopy;
}): Promise<ProviderBatchConnectionTestState> {
  const entries = createQueuedEntries(providers, copy);
  let state: ProviderBatchConnectionTestState = {
    status: 'running',
    total: entries.length,
    completed: 0,
    passed: 0,
    failed: 0,
    message: null,
    entries
  };

  if (entries.length === 0) {
    state = {
      ...state,
      status: 'error',
      message: copy.empty
    };
    onProgress?.(cloneBatchState(state));
    return state;
  }

  onProgress?.(cloneBatchState(state));
  for (const entry of entries) {
    state = {
      ...state,
      entries: state.entries.map((item) =>
        item.providerId === entry.providerId
          ? { ...item, status: 'running', message: copy.running }
          : item
      )
    };
    onProgress?.(cloneBatchState(state));

    const provider = providers.find((item) => item.id === entry.providerId);
    const result = provider
      ? await testProvider(provider)
      : { ok: false as const, error: copy.missingProvider };
    const nextEntry: ProviderBatchConnectionTestEntry = {
      ...entry,
      status: result.ok ? 'success' : 'error',
      message: result.ok ? (result.message ?? copy.connected) : result.error
    };
    state = {
      ...state,
      completed: state.completed + 1,
      passed: state.passed + (result.ok ? 1 : 0),
      failed: state.failed + (result.ok ? 0 : 1),
      entries: state.entries.map((item) =>
        item.providerId === entry.providerId ? nextEntry : item
      )
    };
    onProgress?.(cloneBatchState(state));
  }

  state = {
    ...state,
    status: state.failed > 0 ? 'error' : 'success',
    message: state.failed > 0
      ? copy.doneWithFailures(state.failed, state.passed)
      : copy.doneSuccess(state.passed)
  };
  onProgress?.(cloneBatchState(state));
  return state;
}

export function formatProviderBatchConnectionErrorReport(
  state: ProviderBatchConnectionTestState,
  copy = DEFAULT_PROVIDER_BATCH_CONNECTION_TEST_COPY
) {
  const failedEntries = state.entries.filter((entry) => entry.status === 'error');
  const lines = [
    copy.reportTitle,
    state.message ? copy.reportResult(state.message) : null,
    copy.reportProgress(state),
    ...failedEntries.map((entry, index) =>
      `${index + 1}. ${entry.providerName} · ${entry.model}\n${entry.message}`
    )
  ].filter((line): line is string => Boolean(line));
  return lines.join('\n\n');
}
