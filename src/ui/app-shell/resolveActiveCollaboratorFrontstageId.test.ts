import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import { resolveActiveCollaboratorFrontstageId } from './resolveActiveCollaboratorFrontstageId';

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

describe('resolveActiveCollaboratorFrontstageId', () => {
  it('uses a real frontstage persona as the active collaborator root', () => {
    expect(resolveActiveCollaboratorFrontstageId({
      personas,
      frontstageCollaboratorId: 'persona-2',
      activeCollaboratorId: 'pharos'
    })).toBe('persona-2');
  });

  it('keeps the active collaborator for companion frontstage projections', () => {
    expect(resolveActiveCollaboratorFrontstageId({
      personas,
      frontstageCollaboratorId: 'companion:macbook',
      activeCollaboratorId: 'pharos'
    })).toBe('pharos');
  });

  it('keeps the active collaborator when the frontstage scope is aggregate', () => {
    expect(resolveActiveCollaboratorFrontstageId({
      personas,
      frontstageCollaboratorId: null,
      activeCollaboratorId: 'pharos'
    })).toBe('pharos');
  });
});
