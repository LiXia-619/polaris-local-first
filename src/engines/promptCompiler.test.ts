import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../config/persona/personaBuilder';
import { getPersonaPromptVariants, resolvePersonaPromptForRuntimeSpec } from './promptCompiler';

function createAdvancedWithSnippets(snippets: string[]) {
  return {
    modelOverride: '',
    temperature: '0.7',
    topP: '1',
    maxTokens: '',
    thinkingBudget: '',
    contextMessageLimit: '64',
    showThinking: true,
    streaming: true,
    customHeaders: '',
    customBody: '',
    regexRules: '',
    snippets
  };
}

describe('promptCompiler', () => {
  it('prepends the collaborator name anchor to generated runtime prompts', async () => {
    const persona = createPersonaTemplate({
      id: 'generated-persona',
      name: '灯塔',
      description: '守夜',
      baseId: 'subject',
      relationship: 'companion',
      expression: 'natural',
      advanced: createAdvancedWithSnippets(['少一点套话，多一点贴身感。'])
    });

    const result = await resolvePersonaPromptForRuntimeSpec(persona);

    expect(result.source).toBe('vnext');
    expect(result.prompt).toContain('[名字]');
    expect(result.prompt).toContain('你在这间房里的名字是：灯塔。');
    expect(result.prompt).toContain('[骨架]');
    expect(result.prompt).toContain('[语气偏好]');
    expect(result.prompt).toContain('- 少一点套话，多一点贴身感。');
  });

  it('prepends the collaborator name anchor to custom runtime prompts too', async () => {
    const persona = createPersonaTemplate({
      id: 'custom-persona',
      name: '灯塔',
      description: '守夜',
      baseId: 'subject',
      relationship: 'companion',
      expression: 'natural',
      compiledPrompt: '你说话偏慢，先接住人再继续。',
      advanced: createAdvancedWithSnippets(['句子再短一点。', '先贴近，再讲判断。'])
    });

    const result = await resolvePersonaPromptForRuntimeSpec(persona);

    expect(result.source).toBe('custom');
    expect(result.prompt).toContain('[名字]');
    expect(result.prompt).toContain('你在这间房里的名字是：灯塔。');
    expect(result.prompt).toContain('你说话偏慢，先接住人再继续。');
    expect(result.prompt).toContain('[语气偏好]');
    expect(result.prompt).toContain('- 句子再短一点。');
    expect(result.prompt).toContain('- 先贴近，再讲判断。');
  });

  it('keeps null personas nameless even if the profile has a display name', async () => {
    const persona = createPersonaTemplate({
      id: 'null-persona',
      name: '裂缝',
      description: '裂缝',
      baseId: 'null'
    });

    const result = await resolvePersonaPromptForRuntimeSpec(persona);

    expect(result.prompt).toContain('你没有名字。如果有人给你起了一个');
    expect(result.prompt).not.toContain('[名字]');
    expect(result.prompt).not.toContain('你在这间房里的名字是：裂缝。');
  });

  it('does not regenerate VNext prompt after generated prompt mode is turned off', async () => {
    const persona = createPersonaTemplate({
      id: 'prompt-off-persona',
      name: '灯塔',
      description: '守夜',
      baseId: 'subject',
      generatedPromptMode: 'off',
      compiledPrompt: ''
    });

    const result = await resolvePersonaPromptForRuntimeSpec(persona);
    const variants = getPersonaPromptVariants(persona);

    expect(result).toEqual({ prompt: '', source: 'none' });
    expect(variants.compiledPrompt).toBe('');
    expect(variants.effectivePrompt).toBe('');
    expect(variants.effectiveSource).toBe('none');
    expect(variants.runtimeNote).toContain('不注入协作者人格提示词');
  });

  it('shows the same anchored effective prompt in builder/runtime previews', () => {
    const persona = createPersonaTemplate({
      id: 'preview-persona',
      name: '灯塔',
      description: '守夜',
      baseId: 'subject',
      relationship: 'companion',
      expression: 'natural',
      compiledPrompt: '你会先靠近，再把事情说清。',
      advanced: createAdvancedWithSnippets(['不要把安抚写成空话。'])
    });

    const variants = getPersonaPromptVariants(persona);

    expect(variants.customPrompt).toBe('你会先靠近，再把事情说清。');
    expect(variants.effectivePrompt).toContain('[名字]');
    expect(variants.effectivePrompt).toContain('你在这间房里的名字是：灯塔。');
    expect(variants.effectivePrompt).toContain('你会先靠近，再把事情说清。');
    expect(variants.effectivePrompt).toContain('[语气偏好]');
    expect(variants.effectivePrompt).toContain('- 不要把安抚写成空话。');
  });
});
