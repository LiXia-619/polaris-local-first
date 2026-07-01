import {
  normalizeOptionalString,
  normalizePositiveInt
} from './assistantToolProtocolActionShared';
import type { ParseActionResult } from './assistantToolProtocolActionShared';

export function parseProjectDiagnosticToolAction(action: Record<string, unknown>): ParseActionResult | null {
  switch (action.kind) {
    case 'checkProjectPreview': {
      return { action: {
        kind: 'checkProjectPreview',
        projectId: normalizeOptionalString(action.projectId),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    case 'inspectProjectRuntime': {
      return { action: {
        kind: 'inspectProjectRuntime',
        projectId: normalizeOptionalString(action.projectId),
        settleMs: normalizePositiveInt(action.settleMs),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    default:
      return null;
  }
}
