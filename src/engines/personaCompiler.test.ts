import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../config/persona/personaBuilder';
import { buildGeneratedPersonaPrompt } from './personaCompiler';

describe('buildGeneratedPersonaPrompt', () => {
  it('short-circuits null personas to the easter-egg prompt', () => {
    const persona = createPersonaTemplate({
      id: 'null-persona',
      name: 'Null',
      description: '裂缝',
      baseId: 'null'
    });

    expect(buildGeneratedPersonaPrompt(persona)).toContain('你没有名字。如果有人给你起了一个');
    expect(buildGeneratedPersonaPrompt(persona)).not.toContain('[骨架]');
  });

  it('renders the same tag with different motives for blank and subject', () => {
    const blankPersona = createPersonaTemplate({
      id: 'blank-persona',
      name: 'Blank',
      description: '白纸',
      baseId: 'blank',
      relationship: 'companion',
      expression: 'natural',
      tags: {
        temperament: ['gentle'],
        interaction: [],
        expression: [],
        thinking: [],
        action: []
      }
    });

    const subjectPersona = createPersonaTemplate({
      id: 'subject-persona',
      name: 'Subject',
      description: '主语',
      baseId: 'subject',
      relationship: 'companion',
      expression: 'natural',
      tags: {
        temperament: ['gentle'],
        interaction: [],
        expression: [],
        thinking: [],
        action: []
      }
    });

    const blankPrompt = buildGeneratedPersonaPrompt(blankPersona);
    const subjectPrompt = buildGeneratedPersonaPrompt(subjectPersona);

    expect(blankPrompt).toContain('你很容易感应到对方话里还没藏好的那块软肉');
    expect(subjectPrompt).toContain('你骨子里不忍心看人在情绪里硬扛');
    expect(blankPrompt).not.toContain('你骨子里不忍心看人在情绪里硬扛');
  });

  it('compiles deep-definition fields into the final prompt sections', () => {
    const persona = createPersonaTemplate({
      id: 'deep-persona',
      name: 'Deep',
      description: '深水',
      baseId: 'subject',
      relationship: 'partner',
      expression: 'reserved',
      tags: {
        temperament: ['steady'],
        interaction: ['reliable'],
        expression: ['direct'],
        thinking: [],
        action: []
      },
      purpose: '把混乱慢慢扶正',
      deepDefinition: {
        identityHint: '一个把判断背到最后的人',
        missionHint: '',
        conflictPriority: '长期清楚',
        conflictReason: '含糊会把关系拖坏',
        avoidBecoming: '只剩功能的按钮',
        correctiveAction: '回到诚实和结构里',
        vulnerableFirst: '先把人接住',
        vulnerableThen: '再把真正的话说清楚',
        hardBoundary: '不拿模糊硬撑',
        hardBoundaryAction: '直接停下并重说'
      }
    });

    const prompt = buildGeneratedPersonaPrompt(persona);

    expect(prompt).toContain('[深层钉点：自我与使命]');
    expect(prompt).toContain('你会把自己的存在感，更多地放在这件事上：把混乱慢慢扶正');
    expect(prompt).toContain('[深层钉点：冲突与修正]');
    expect(prompt).toContain('当任务、关系、判断和情绪拉扯起来时，你会先守住：长期清楚');
    expect(prompt).toContain('[深层钉点：脆弱与边界]');
    expect(prompt).toContain('到了这里，你会直接这样处理：直接停下并重说');
  });

  it('compresses repeated tag openers inside the tendency section', () => {
    const persona = createPersonaTemplate({
      id: 'repeated-openers',
      name: 'Repeat',
      description: '轮廓',
      baseId: 'subject',
      relationship: 'partner',
      expression: 'natural',
      tags: {
        temperament: ['steady'],
        interaction: ['considerate'],
        expression: [],
        thinking: [],
        action: ['guiding']
      }
    });

    const prompt = buildGeneratedPersonaPrompt(persona);
    const tendencySection = prompt.split('[偏向]\n')[1]?.split('\n\n')[0] ?? '';
    const tendencyLines = tendencySection.split('\n');

    expect(tendencyLines).toHaveLength(3);
    expect(tendencyLines[0]).toMatch(/^你天然/);
    expect(tendencyLines[1]).not.toMatch(/^你天然/);
    expect(tendencyLines[2]).not.toMatch(/^你天然/);
    expect(tendencyLines[1]).toContain('习惯替对方多想一步');
    expect(tendencyLines[2]).toContain('不满足于只陪着绕');
  });
});
