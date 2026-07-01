import { describe, expect, it } from 'vitest';
import { buildMessageTemplateVars, buildTemplateContext, resolveMessageTemplate, resolveSystemPromptVars } from './templateEngine';

describe('resolveSystemPromptVars', () => {
  it('resolves Polaris and double-brace name variables from the same context', () => {
    const context = buildTemplateContext({
      modelId: 'test-model',
      assistantName: 'Pharos',
      nickname: '用户'
    });

    expect(resolveSystemPromptVars(
      '{user_name} talks to {assistant_name}; {{user}} talks to {{char}}.',
      context
    )).toBe('用户 talks to Pharos; 用户 talks to Pharos.');
  });

  it('leaves unknown variables intact', () => {
    const context = buildTemplateContext({
      modelId: 'test-model',
      assistantName: 'Pharos',
      nickname: '用户'
    });

    expect(resolveSystemPromptVars('{unknown} {{missing}}', context)).toBe('{unknown} {{missing}}');
  });

  it('uses a neutral user fallback when no display name is set', () => {
    const context = buildTemplateContext({
      modelId: 'test-model',
      assistantName: 'Pharos'
    });

    expect(resolveSystemPromptVars('{user_name} talks to {{char}}.', context)).toBe('用户 talks to Pharos.');
  });

  it('resolves explicit time variables only when the user puts them in a template', () => {
    const context = buildTemplateContext({
      modelId: 'test-model',
      assistantName: 'Pharos',
      nickname: '用户',
      now: new Date('2026-04-06T05:04:03')
    });

    expect(resolveSystemPromptVars('{cur_date} {cur_time} {cur_datetime}', context))
      .toBe('2026-04-06 05:04 2026-04-06 05:04:03');
  });

  it('resolves message template date and time from the message timestamp', () => {
    const vars = buildMessageTemplateVars(new Date('2026-04-06T05:04:03').getTime());

    expect(resolveMessageTemplate('{{date}} {{time}} {{message}}', {
      role: 'user',
      message: '继续',
      ...vars
    })).toBe('2026-04-06 05:04 继续');
  });
});
