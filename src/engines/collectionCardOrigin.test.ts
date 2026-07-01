import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../config/persona/personaBuilder';
import { codeCardOriginLabel, imageAssetOriginLabel } from './collectionCardOrigin';
import type { CodeCard, Conversation, ImageAssetCard, Persona } from '../types/domain';

const personas: Persona[] = [
  createPersonaTemplate({
    id: 'lyra',
    systemRole: 'default',
    name: 'Lyra',
    description: '',
    builderManaged: false,
    baseId: 'custom',
    relationship: 'assistant',
    expression: 'natural',
    tags: {
      temperament: ['steady', 'cool'],
      interaction: ['reliable'],
      expression: ['rational'],
      thinking: ['strict'],
      action: ['gather']
    },
    initiative: 'balanced',
    memoryStyle: 'quiet',
    silence: 'wait',
    disagreement: 'honest',
    humor: 'dry',
    attachment: 'presence',
    curiosity: 'respectful',
    selfDisclosure: 'selective',
    deepDefinition: {
      identityHint: '',
      missionHint: '',
      conflictPriority: '',
      conflictReason: '',
      avoidBecoming: '',
      correctiveAction: '',
      vulnerableFirst: '',
      vulnerableThen: '',
      hardBoundary: '',
      hardBoundaryAction: ''
    },
    memory: {
      inheritGlobal: true,
      crossConversationRecallEnabled: true,
      excludedGlobalIds: [],
      personalMemories: [],
      referenceDocs: []
    }
  })
];

const conversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Archive Corridor',
    collaboratorId: 'lyra',
    pinnedAt: null,
    updatedAt: 1,
    messages: []
  }
];

describe('codeCardOriginLabel', () => {
  it('shows owner first and lineage second when both exist', () => {
    const card: CodeCard = {
      id: 'card-1',
      kind: 'card',
      title: 'Card',
      language: 'txt',
      code: 'hello',
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1,
      ownerCollaboratorId: 'lyra',
      originConversationId: 'conv-1',
      originBlockIndex: 0
    };

    expect(codeCardOriginLabel(card, conversations, personas)).toBe('Lyra · Archive Corridor · 第 1 段代码');
  });

  it('falls back to owner-only when lineage is absent', () => {
    const card: CodeCard = {
      id: 'card-2',
      kind: 'card',
      title: 'Card',
      language: 'txt',
      code: 'hello',
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1,
      ownerCollaboratorId: 'lyra'
    };

    expect(codeCardOriginLabel(card, conversations, personas)).toBe('Lyra');
  });
});

describe('imageAssetOriginLabel', () => {
  it('keeps owner and lineage distinct in image origin copy', () => {
    const card: ImageAssetCard = {
      id: 'asset-1',
      assetId: 'asset-binary-1',
      title: 'Image',
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1,
      ownerCollaboratorId: 'lyra',
      originConversationId: 'conv-1'
    };

    expect(imageAssetOriginLabel(card, conversations, personas)).toBe('来自 Lyra · Archive Corridor');
  });
});
