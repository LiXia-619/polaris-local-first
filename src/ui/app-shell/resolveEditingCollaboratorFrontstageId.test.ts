import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import { resolveEditingCollaboratorFrontstageId } from './resolveEditingCollaboratorFrontstageId';

const personas = [
  createPersonaTemplate({
    id: 'pharos',
    name: 'Pharos',
    description: '灯塔'
  }),
  createPersonaTemplate({
    id: 'persona-2',
    name: 'Nova',
    description: '第二人格'
  })
];

describe('resolveEditingCollaboratorFrontstageId', () => {
  it('uses the frontstage collaborator as the room settings target', () => {
    expect(resolveEditingCollaboratorFrontstageId({
      personas,
      editingCollaboratorId: 'persona-2',
      frontstageCollaboratorId: 'pharos',
      activeCollaboratorId: 'pharos'
    })).toBe('pharos');
  });

  it('falls back to the editing collaborator when there is no frontstage collaborator', () => {
    expect(resolveEditingCollaboratorFrontstageId({
      personas,
      editingCollaboratorId: 'persona-2',
      frontstageCollaboratorId: null,
      activeCollaboratorId: 'pharos'
    })).toBe('persona-2');
  });

  it('skips companion collaborators and falls back to the active persona', () => {
    expect(resolveEditingCollaboratorFrontstageId({
      personas,
      editingCollaboratorId: null,
      frontstageCollaboratorId: 'companion:macbook',
      activeCollaboratorId: 'pharos'
    })).toBe('pharos');
  });

  it('falls back to the first persona when the active collaborator is missing', () => {
    expect(resolveEditingCollaboratorFrontstageId({
      personas,
      editingCollaboratorId: null,
      frontstageCollaboratorId: null,
      activeCollaboratorId: 'missing'
    })).toBe('pharos');
  });
});
