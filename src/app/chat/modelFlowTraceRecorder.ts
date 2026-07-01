import { isModelFlowTraceCaptureEnabled } from '../developer/debugCaptureRuntime';
import type { ModelFlowTraceRecordArgs } from './modelFlowTraceRuntime';

export function recordModelFlowTrace(args: ModelFlowTraceRecordArgs) {
  if (!isModelFlowTraceCaptureEnabled()) return;

  void import('./modelFlowTraceRuntime')
    .then(({ recordModelFlowTrace: recordTraceEntry }) => {
      recordTraceEntry(args);
    })
    .catch((error) => {
      console.warn('[polaris-model-flow] failed to load trace runtime', error);
    });
}
