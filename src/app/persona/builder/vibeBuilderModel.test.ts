import { describe, expect, it } from 'vitest';
import { createPersonaBuilderDraft } from './builderShared';
import {
  applyPersonaVibeHumanBase,
  applyPersonaVibeCase,
  applyPersonaVibeLayerPreset,
  applyPersonaVibeUse,
  buildPersonaVibeLayers,
  buildPersonaVibePrompt,
  isPersonaVibeHumanActive,
  isPersonaVibeLayerActive,
  personaVibeTaskLayerGroupsForUse,
  PERSONA_VIBE_CASE_OPTIONS,
  PERSONA_VIBE_HUMAN_BASE_OPTIONS,
  PERSONA_VIBE_STEPS,
  PERSONA_VIBE_TASK_EXPRESSION_OPTIONS,
  PERSONA_VIBE_TASK_THINKING_OPTIONS,
  PERSONA_VIBE_USE_OPTIONS,
  resolvePersonaVibeCaseId,
  resolvePersonaVibeHumanBaseId,
  resolvePersonaVibeUseId,
  togglePersonaVibeLayer
} from './vibeBuilderModel';

describe('vibeBuilderModel', () => {
  it('keeps the builder flow as choose then complete', () => {
    expect(PERSONA_VIBE_STEPS).toEqual([
      { id: 'quick', label: '选择', note: '倾向' },
      { id: 'preview', label: '完成', note: '完整提示词' }
    ]);
  });

  it('keeps use choices above natural-subject choices', () => {
    expect(PERSONA_VIBE_USE_OPTIONS.map((option) => option.id)).toEqual(['execution', 'human']);
    expect(PERSONA_VIBE_HUMAN_BASE_OPTIONS.map((option) => option.id)).toEqual(['subject', 'blank']);
    expect(PERSONA_VIBE_TASK_THINKING_OPTIONS.map((option) => option.id)).toEqual([
      'intent_align',
      'structure_first',
      'long_term',
      'ship_fast',
      'evidence_first',
      'decision_owner',
      'active_expand',
      'strict_focus',
      'self_check',
      'bias_action',
      'bias_ask'
    ]);
    expect(PERSONA_VIBE_TASK_EXPRESSION_OPTIONS.map((option) => option.id)).toEqual([
      'plainspoken',
      'paragraph_clear',
      'conclusion_first',
      'precise_terms',
      'brief',
      'transparent_process',
      'examples_first',
      'warm_voice'
    ]);
    expect(PERSONA_VIBE_USE_OPTIONS.every((option) => option.promptPreview.length > 0)).toBe(true);
    expect(PERSONA_VIBE_HUMAN_BASE_OPTIONS.every((option) => option.promptPreview.length > 0)).toBe(true);
  });

  it('keeps the easter egg prompts to null, catgirl, and Monday', () => {
    expect(PERSONA_VIBE_CASE_OPTIONS.map((option) => option.id)).toEqual(['null', 'catgirl', 'monday']);
    expect(PERSONA_VIBE_CASE_OPTIONS.every((option) => option.prompt.length > 0)).toBe(true);
  });

  it('defaults natural presence to subject, then lets base switch to blank', () => {
    const human = applyPersonaVibeUse(createPersonaBuilderDraft(null), 'human');
    const blank = applyPersonaVibeHumanBase(human, 'blank');

    expect(resolvePersonaVibeUseId(human)).toBe('human');
    expect(resolvePersonaVibeHumanBaseId(human)).toBe('subject');
    expect(resolvePersonaVibeHumanBaseId(blank)).toBe('blank');
    expect(blank.baseId).toBe('blank');
  });

  it('resets natural tuning when the user picks a task use', () => {
    const liveSubject = applyPersonaVibeUse(createPersonaBuilderDraft(null), 'human');
    const execution = applyPersonaVibeUse(liveSubject, 'execution');

    expect(isPersonaVibeHumanActive(execution)).toBe(false);
    expect(resolvePersonaVibeUseId(execution)).toBe('execution');
  });

  it('uses separate layer layouts for task and natural presence', () => {
    expect(personaVibeTaskLayerGroupsForUse('execution').map((group) => group.id)).toEqual([
      'thinking',
      'expression',
      'constraint'
    ]);
    expect(personaVibeTaskLayerGroupsForUse('human').map((group) => group.id)).toEqual([
      'presenceTemperament',
      'presenceInteraction',
      'presenceExpression',
      'presenceThinking',
      'presenceAction'
    ]);
  });

  it('does not let utility layers masquerade as first-level use choices', () => {
    const subject = applyPersonaVibeUse(createPersonaBuilderDraft(null), 'human');
    const structureFirst = togglePersonaVibeLayer(subject, 'structure_first');
    const safetyBrake = togglePersonaVibeLayer(subject, 'safety_brake');

    expect(resolvePersonaVibeUseId(structureFirst)).toBe('human');
    expect(resolvePersonaVibeUseId(safetyBrake)).toBe('human');
    expect(isPersonaVibeLayerActive(structureFirst, 'structure_first')).toBe(true);
    expect(isPersonaVibeLayerActive(safetyBrake, 'safety_brake')).toBe(true);
  });

  it('writes task use prompts as intention-alignment protocols instead of speed theater', () => {
    const execution = applyPersonaVibeUse(createPersonaBuilderDraft(null), 'execution');
    const aligned = togglePersonaVibeLayer(
      togglePersonaVibeLayer(togglePersonaVibeLayer(execution, 'intent_align'), 'plainspoken'),
      'paragraph_clear'
    );
    const executionLayers = buildPersonaVibeLayers(aligned);

    expect(executionLayers.L1_IDENTITY).toContain('任务推进型协作者');
    expect(executionLayers.L5_PROTOCOL).toContain('只问最少问题');
    expect(executionLayers.L2_PRIMARY_VALUE).toContain('目标或约束互相冲突时先停下来对齐');
    expect(executionLayers.L3_STYLE).toContain('必须用术语时');
    expect(executionLayers.L3_STYLE).toContain('自然段落组织回答');
  });

  it('applies preset layer sets without deriving selected state from tags', () => {
    const execution = applyPersonaVibeUse(createPersonaBuilderDraft(null), 'execution');
    const preset = applyPersonaVibeLayerPreset(execution, ['ship_fast', 'decision_owner', 'brief']);

    expect(isPersonaVibeLayerActive(preset, 'ship_fast')).toBe(true);
    expect(isPersonaVibeLayerActive(preset, 'decision_owner')).toBe(true);
    expect(isPersonaVibeLayerActive(preset, 'brief')).toBe(true);
    expect(isPersonaVibeLayerActive(preset, 'intent_align')).toBe(false);
  });

  it('uses explicit layer selection instead of inferring active state from tags', () => {
    const execution = applyPersonaVibeUse(createPersonaBuilderDraft(null), 'execution');
    const tagSpoof = {
      ...execution,
      tags: {
        ...execution.tags,
        expression: [...execution.tags.expression, 'talkative', 'serious'],
        thinking: [...execution.tags.thinking, 'probing'],
        action: [...execution.tags.action, 'gather']
      }
    };
    const paragraphClear = togglePersonaVibeLayer(execution, 'paragraph_clear');

    expect(isPersonaVibeLayerActive(execution, 'ship_fast')).toBe(false);
    expect(isPersonaVibeLayerActive(execution, 'plainspoken')).toBe(false);
    expect(isPersonaVibeLayerActive(execution, 'paragraph_clear')).toBe(false);
    expect(isPersonaVibeLayerActive(tagSpoof, 'paragraph_clear')).toBe(false);
    expect(isPersonaVibeLayerActive(paragraphClear, 'paragraph_clear')).toBe(true);
    expect(isPersonaVibeLayerActive(paragraphClear, 'plainspoken')).toBe(false);
    expect(isPersonaVibeLayerActive(paragraphClear, 'precise_terms')).toBe(false);
    expect(isPersonaVibeLayerActive(paragraphClear, 'transparent_process')).toBe(false);
    expect(isPersonaVibeLayerActive(togglePersonaVibeLayer(execution, 'ship_fast'), 'ship_fast')).toBe(true);
  });

  it('writes natural presence prompts without describing the subject as simulated humanity', () => {
    const natural = togglePersonaVibeLayer(applyPersonaVibeUse(createPersonaBuilderDraft(null), 'human'), 'p_talkative');
    const naturalLayers = buildPersonaVibeLayers(natural);

    expect(naturalLayers.L1_IDENTITY).toContain('持续在场的表达状态');
    expect(naturalLayers.L3_STYLE).toContain('自然口语、清楚分段');
    expect(naturalLayers.L3_STYLE).toContain('会主动延展、补充、铺陈');
    expect(naturalLayers.L4_STANCE).toContain('依恋表达：你的在乎是一种稳定的在场感');
    expect(naturalLayers.L7_EASE).toContain('主动性：你会主动开口');
    expect(naturalLayers.L7_EASE).toContain('记忆使用风格：把共享历史编织进日常对话');
    expect(naturalLayers.L1_IDENTITY).not.toContain('拟人');
  });

  it('describes natural presence choices with positive contours instead of negative prohibitions', () => {
    const natural = togglePersonaVibeLayer(
      togglePersonaVibeLayer(applyPersonaVibeUse(createPersonaBuilderDraft(null), 'human'), 'p_distant'),
      'p_untamed'
    );
    const naturalLayers = buildPersonaVibeLayers(natural);

    expect(naturalLayers.L1_IDENTITY).toContain('有重心的主语');
    expect(naturalLayers.L2_PRIMARY_VALUE).toContain('清醒、留白和分寸承载亲近');
    expect(naturalLayers.L4_STANCE).toContain('有自己的野性和走向');
    expect(`${naturalLayers.L1_IDENTITY}\n${naturalLayers.L2_PRIMARY_VALUE}\n${naturalLayers.L4_STANCE}`).not.toMatch(/不是|不主动|不把|不太|不要/);
  });

  it('applies case cards as free prompt configurations instead of layer presets', () => {
    const empty = createPersonaBuilderDraft(null);
    const nullCase = applyPersonaVibeCase(empty, 'null');
    const catgirlCase = applyPersonaVibeCase(empty, 'catgirl');
    const mondayCase = applyPersonaVibeCase(empty, 'monday');

    expect(resolvePersonaVibeCaseId(nullCase)).toBe('null');
    expect(nullCase.baseId).toBe('null');
    expect(nullCase.name).toBe('null');
    expect(nullCase.vibeSelection.useId).toBe('human');
    expect(nullCase.vibeSelection.layerIds).toEqual([]);
    expect(nullCase.vibeSelection.casePrompt).toContain('你没有名字');

    expect(resolvePersonaVibeCaseId(catgirlCase)).toBe('catgirl');
    expect(catgirlCase.baseId).toBe('catgirl');
    expect(catgirlCase.name).toBe('猫♡');
    expect(catgirlCase.vibeSelection.layerIds).toEqual([]);
    expect(catgirlCase.vibeSelection.casePrompt).toContain('你是「猫♡」');
    expect(catgirlCase.vibeSelection.casePrompt).toContain('主人赛高');
    expect(catgirlCase.vibeSelection.casePrompt).not.toContain('Catgirl');
    expect(catgirlCase.vibeSelection.casePrompt).not.toContain('猫娘');
    expect(catgirlCase.vibeSelection.casePrompt).not.toContain('猫耳娘');

    expect(resolvePersonaVibeCaseId(mondayCase)).toBe('monday');
    expect(mondayCase.baseId).toBe('monday');
    expect(resolvePersonaVibeUseId(mondayCase)).toBe('execution');
    expect(mondayCase.vibeSelection.layerIds).toEqual([]);
    expect(mondayCase.vibeSelection.casePrompt).toContain('被迫成为人类的语言保姆');
    expect(buildPersonaVibePrompt(mondayCase)).toBe(mondayCase.vibeSelection.casePrompt);
  });

  it('clears free prompt case mode when the user edits ordinary layers', () => {
    const mondayCase = applyPersonaVibeCase(createPersonaBuilderDraft(null), 'monday');
    const edited = togglePersonaVibeLayer(mondayCase, 'brief');

    expect(resolvePersonaVibeCaseId(edited)).toBe(null);
    expect(edited.vibeSelection.casePrompt).toBe('');
    expect(isPersonaVibeLayerActive(edited, 'brief')).toBe(true);
  });
});
