import { describe, expect, it } from 'vitest';
import { parseAssistantTaskUpdate, stripTaskBlocksFromReply } from './conversationTaskUpdateParser';

describe('stripTaskBlocksFromReply', () => {
  it('removes hidden polaris-task blocks from visible reply text', () => {
    const content = [
      '我先把页面壳起好。',
      '```polaris-task',
      '{"id":"task-1","title":"搭页面","status":"running","stage":"写 HTML","steps":[]}',
      '```'
    ].join('\n');

    expect(stripTaskBlocksFromReply(content)).toBe('我先把页面壳起好。');
  });
});

describe('parseAssistantTaskUpdate', () => {
  it('parses the last polaris-task block into a task update', () => {
    const content = [
      '先继续往下做。',
      '```polaris-task',
      JSON.stringify({
        id: 'task-1',
        title: '搭建小 iPhone 界面',
        status: 'running',
        stage: '继续补 script.js',
        summary: 'HTML 和 CSS 已经落下。',
        focus: '我先把交互补顺。',
        next: '等下跑一遍验证。',
        steps: [
          { id: 'step-1', title: '创建 index.html', status: 'completed' },
          { id: 'step-2', title: '创建 script.js', status: 'in_progress' }
        ]
      }),
      '```'
    ].join('\n');

    const parsed = parseAssistantTaskUpdate(content);

    expect(parsed.displayContent).toBe('先继续往下做。');
    expect(parsed.taskUpdate).toEqual({
      id: 'task-1',
      title: '搭建小 iPhone 界面',
      status: 'running',
      stage: '继续补 script.js',
      summary: 'HTML 和 CSS 已经落下。',
      focus: '我先把交互补顺。',
      next: '等下跑一遍验证。',
      steps: [
        { id: 'step-1', title: '创建 index.html', status: 'completed', detail: undefined },
        { id: 'step-2', title: '创建 script.js', status: 'in_progress', detail: undefined }
      ]
    });
  });

  it('drops malformed task blocks from visible text without trusting them', () => {
    const content = [
      '继续做下一步。',
      '```polaris-task',
      '{"id":"task-1","title":"坏掉了"',
      '```'
    ].join('\n');

    const parsed = parseAssistantTaskUpdate(content);

    expect(parsed.displayContent).toBe('继续做下一步。');
    expect(parsed.taskUpdate).toBeNull();
  });
});
