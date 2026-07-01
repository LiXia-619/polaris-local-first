import { describe, expect, it } from 'vitest';
import { toolEventCopy } from './chatToolLabels';
import type { ToolInvocation } from '../../../types/domain';

function baseToolInvocation(partial: Partial<ToolInvocation>): ToolInvocation {
  return {
    id: 'tool-1',
    kind: 'patchRawCss',
    status: 'preview',
    title: '创意 CSS 试穿',
    summary: '回复气泡 · .app-shell.chat .bubble.assistant { background: pink; }',
    ...partial
  };
}

describe('chatToolLabels', () => {
  it('describes creative previews without mount jargon', () => {
    expect(toolEventCopy(baseToolInvocation({
      themeScope: 'chat'
    }))).toContain('可应用这版，或取消这次试穿');
  });

  it('describes applied creative previews without old shell language', () => {
    expect(toolEventCopy(baseToolInvocation({
      themeScope: 'app',
      status: 'applied'
    }))).toContain('这一版改动已保留');
  });
});
