import { describe, expect, it } from 'vitest';
import { parseProjectDiagnosticToolAction } from './assistantToolProtocolActionProjectDiagnostics';

describe('parseProjectDiagnosticToolAction', () => {
  it('parses preview checks with optional project targeting', () => {
    expect(parseProjectDiagnosticToolAction({
      kind: 'checkProjectPreview',
      projectId: 'mini-phone',
      targetLabel: 'Mini Phone'
    })).toEqual({
      action: {
        kind: 'checkProjectPreview',
        projectId: 'mini-phone',
        targetLabel: 'Mini Phone'
      }
    });
  });

  it('parses runtime inspections and normalizes settleMs', () => {
    expect(parseProjectDiagnosticToolAction({
      kind: 'inspectProjectRuntime',
      projectId: 'mini-phone',
      settleMs: '1200'
    })).toEqual({
      action: {
        kind: 'inspectProjectRuntime',
        projectId: 'mini-phone',
        settleMs: 1200,
        targetLabel: undefined
      }
    });

    expect(parseProjectDiagnosticToolAction({
      kind: 'inspectProjectRuntime',
      settleMs: -1
    })).toEqual({
      action: {
        kind: 'inspectProjectRuntime',
        projectId: undefined,
        settleMs: undefined,
        targetLabel: undefined
      }
    });
  });

  it('returns null for unrelated actions', () => {
    expect(parseProjectDiagnosticToolAction({ kind: 'readProjectFile' })).toBeNull();
  });
});
