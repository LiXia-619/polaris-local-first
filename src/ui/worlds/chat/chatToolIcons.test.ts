import { describe, expect, it } from 'vitest';
import type { ToolInvocation } from '../../../types/domain';
import { toolIconName } from './chatToolIcons';

function tool(kind: ToolInvocation['kind']): ToolInvocation {
  return {
    id: `tool-${kind}`,
    kind,
    status: 'executed',
    title: kind,
    summary: kind
  } as ToolInvocation;
}

describe('toolIconName', () => {
  it('uses neutral file icons for read-style tool events', () => {
    expect(toolIconName(tool('readProjectFile'))).toBe('fileText');
    expect(toolIconName(tool('readCodeCard'))).toBe('fileText');
    expect(toolIconName(tool('readAttachmentText'))).toBe('fileText');
    expect(toolIconName(tool('readArchiveEntryText'))).toBe('fileText');
  });

  it('keeps inspection tools neutral instead of eye-shaped', () => {
    expect(toolIconName(tool('listProjectFiles'))).toBe('folder');
    expect(toolIconName(tool('searchProjectFiles'))).toBe('search');
    expect(toolIconName(tool('inspectAttachments'))).toBe('folder');
    expect(toolIconName(tool('inspectArchiveEntries'))).toBe('folder');
    expect(toolIconName(tool('checkProjectPreview'))).toBe('check');
    expect(toolIconName(tool('inspectProjectRuntime'))).toBe('zap');
  });
});
