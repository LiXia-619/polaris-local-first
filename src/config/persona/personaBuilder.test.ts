import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from './personaBuilder';

function createAdvanced(maxTokens: string) {
  return {
    modelOverride: '',
    temperature: '0.7',
    topP: '',
    maxTokens,
    thinkingBudget: '',
    contextMessageLimit: '',
    showThinking: true,
    streaming: true,
    customHeaders: '',
    customBody: '',
    regexRules: '',
    snippets: []
  };
}

describe('createPersonaTemplate', () => {
  it('migrates the legacy 65536 max token default back to provider default', () => {
    const persona = createPersonaTemplate({
      id: 'persona-test',
      name: '测试助手',
      description: '测试',
      advanced: createAdvanced('65536')
    });

    expect(persona.advanced.maxTokens).toBe('');
  });

  it('preserves other explicit max token values', () => {
    const persona = createPersonaTemplate({
      id: 'persona-test',
      name: '测试助手',
      description: '测试',
      advanced: createAdvanced('8192')
    });

    expect(persona.advanced.maxTokens).toBe('8192');
  });
});
