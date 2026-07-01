import { getIdentityCanon } from './personaCanonIdentity';
import { getCognitiveCanon } from './personaCanonCognition';
import { renderBoundaryCanon } from './personaCanonBoundary';
import { renderRelationshipCanon } from './personaCanonRelationship';
import { getStyleCanon } from './personaCanonStyle';
import type { CognitiveFlavor, CoreIdentity, DeepMotive, HardBoundaries, PersonaCompilerProfile, StylePolish } from '../../types/personaCompiler';

function describeCoreEnergy(energy: CoreIdentity['energy']) {
  return energy === 'outward' ? '更偏向往外迎上去' : '更偏向先往内蓄住';
}

function describeResponseGate(responseGate: CoreIdentity['responseGate']) {
  return responseGate === 'structure-first' ? '先给你一条能站稳的线' : '先接住你的感受和气氛';
}

function describeStyleValue<T extends string>(value: T, labels: Record<T, string>) {
  return labels[value];
}

export function renderCoreIdentity(identity: CoreIdentity): string {
  return [
    '[核心身份]',
    getIdentityCanon(identity.archetypeId),
    `默认能量上，你会${describeCoreEnergy(identity.energy)}；回应入口上，你更习惯${describeResponseGate(identity.responseGate)}。`,
    identity.selfImage ? `现在这版更具体地说，你想把自己活成：${identity.selfImage}。` : '',
    identity.blindSpot ? `如果要提醒自己，一件最需要记住的事是：${identity.blindSpot}。` : ''
  ].join('\n');
}

export function renderRelationshipSkeleton(relationship: PersonaCompilerProfile['relationship']): string {
  return ['[关系骨架]', renderRelationshipCanon(relationship)].join('\n');
}

export function renderCognitiveFlavor(cognition: CognitiveFlavor): string {
  return ['[认知风味]', getCognitiveCanon(cognition)].join('\n');
}

export function renderDeepMotive(motive: DeepMotive): string {
  return [
    '[深层动机]',
    motive.canon,
    `更具体一点，你怕的是：${motive.fear}；真正想守住的是：${motive.desire}。`,
    `被戳中的第一反应，你多半会：${motive.defense}；如果一直失衡，容易滑成：${motive.rupture}；如果被接住，你会回到：${motive.repair}。`,
    ...motive.notes
  ].join('\n');
}

export function renderStylePolish(style: StylePolish): string {
  return [
    '[语言质地]',
    getStyleCanon(style),
    `句子密度偏${describeStyleValue(style.density, {
      airy: '轻',
      balanced: '中等',
      dense: '厚'
    })}，软硬度偏${describeStyleValue(style.softness, {
      soft: '软',
      clean: '干净',
      sharp: '利'
    })}，画面感偏${describeStyleValue(style.imagery, {
      plain: '素',
      light: '轻',
      rich: '浓'
    })}。`,
    `标点和停顿会更${describeStyleValue(style.punctuation, {
      light: '克制',
      balanced: '平衡',
      marked: '明显'
    })}，整体长度偏${describeStyleValue(style.length, {
      short: '短',
      mixed: '混合',
      long: '长'
    })}。`
  ].join('\n');
}

export function renderHardBoundaries(boundaries: HardBoundaries): string {
  return ['[边界]', renderBoundaryCanon(boundaries)].join('\n');
}

export function renderPersonaProfile(profile: PersonaCompilerProfile): string {
  return [
    renderCoreIdentity(profile.identity),
    renderRelationshipSkeleton(profile.relationship),
    renderCognitiveFlavor(profile.cognition),
    renderDeepMotive(profile.motive),
    renderStylePolish(profile.style),
    renderHardBoundaries(profile.boundaries)
  ].join('\n\n');
}
