import { describe, expect, it } from 'vitest';
import { buildAssistantSpeechText } from './messageSpeechText';

describe('buildAssistantSpeechText', () => {
  it('keeps assistant prose while removing tool draft windows', () => {
    const speechText = buildAssistantSpeechText([
      '我把界面入口拆开了。',
      '',
      '```polaris-tools',
      '{"actions":[{"kind":"patchRawCss","css":".system-inline-note{color:red}"}]}',
      '```',
      '',
      '现在语音会走单独面板。'
    ].join('\n'));

    expect(speechText).toBe('我把界面入口拆开了。\n现在语音会走单独面板。');
    expect(speechText).not.toContain('polaris-tools');
    expect(speechText).not.toContain('patchRawCss');
    expect(speechText).not.toContain('system-inline-note');
  });

  it('removes code blocks and leaves only readable body text', () => {
    const speechText = buildAssistantSpeechText([
      '这里真正要听的是这句。',
      '',
      '```tsx',
      '<SystemWindow title="debug">不要朗读这个</SystemWindow>',
      '```',
      '',
      '这句也应该留下。'
    ].join('\n'));

    expect(speechText).toBe('这里真正要听的是这句。\n这句也应该留下。');
    expect(speechText).not.toContain('SystemWindow');
    expect(speechText).not.toContain('不要朗读这个');
  });

  it('normalizes markdown chrome before speech playback', () => {
    const speechText = buildAssistantSpeechText([
      '### 结论',
      '- **只读正文**',
      '- 看这个 [设置项](https://example.test/settings)',
      '> 不读引用壳'
    ].join('\n'));

    expect(speechText).toBe('结论\n只读正文\n看这个 设置项\n不读引用壳');
  });

  it('returns empty text for tool-only replies', () => {
    expect(buildAssistantSpeechText([
      '```polaris-tools',
      '{"actions":[{"kind":"startTask","title":"整理"}]}',
      '```'
    ].join('\n'))).toBe('');
  });
});
