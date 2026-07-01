import { describe, expect, it } from 'vitest';
import { describeToolAction } from './toolExecutorDescribe';

describe('describeToolAction', () => {
  it('labels wait actions as polling waits', () => {
    const description = describeToolAction({
      kind: 'wait',
      seconds: 1.5,
      reason: '等待 MCP 截图写入'
    });

    expect(description).toMatchObject({
      kind: 'wait',
      title: '等待轮询',
      summary: '等待 MCP 截图写入 · 1.5 秒',
      targetLabel: '等待 MCP 截图写入'
    });
  });

  it('labels raw CSS that only touches chat selectors as chat scoped', () => {
    const description = describeToolAction({
      kind: 'patchRawCss',
      label: '北极星主题扩展至收藏区',
      css: [
        '.app-shell.chat { background: #0d1117; }',
        '.app-shell.chat .bubble.assistant { color: #f8fbff; }'
      ].join('\n\n')
    });

    expect(description.themeScope).toBe('chat');
    expect(description.themeSurfaceLabels).toEqual(['对话背景', '助手正文']);
    expect(description.summary).toContain('对话背景、助手正文');
  });

  it('labels raw CSS that touches collection selectors as collection scoped', () => {
    const description = describeToolAction({
      kind: 'patchRawCss',
      css: [
        '.app-shell.collection { background: #111827; }',
        '.app-shell.collection .world-collection .card { border-color: #93c5fd; }'
      ].join('\n\n')
    });

    expect(description.themeScope).toBe('collection');
    expect(description.themeSurfaceLabels).toEqual(['收藏背景', '全部内容卡统一皮肤']);
  });

  it('labels collection bottom tab icon CSS as the bottom tab surface', () => {
    const description = describeToolAction({
      kind: 'patchRawCss',
      css: '.app-shell.collection .shelf-tab-icon { color: #a5b4fc; }'
    });

    expect(description.themeScope).toBe('collection');
    expect(description.themeSurfaceLabels).toEqual(['收藏底栏']);
  });

  it('labels workspace cover CSS as the workspace cover surface', () => {
    const description = describeToolAction({
      kind: 'patchRawCss',
      css: '.app-shell.collection .world-collection .project-cover-card::before { opacity: 0.4; }'
    });

    expect(description.themeScope).toBe('collection');
    expect(description.themeSurfaceLabels).toEqual(['工作区封面']);
  });
});
