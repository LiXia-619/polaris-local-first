import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import type { Persona } from '../../types/domain';
import {
  buildPersonaLocalDataUnitOfWork,
  getPersonaDomainMetaLocalDataRef,
  getPersonaObjectLocalDataRef,
  toPersonaObjectId
} from './personaRows';

function persona(seed: Partial<Persona> & Pick<Persona, 'id'>): Persona {
  return createPersonaTemplate({
    id: seed.id,
    name: seed.name ?? seed.id,
    description: seed.description ?? '',
    assistantAvatarAssetId: seed.assistantAvatarAssetId,
    userAvatarAssetId: seed.userAvatarAssetId,
    memory: seed.memory,
    version: seed.version
  });
}

describe('buildPersonaLocalDataUnitOfWork', () => {
  it('projects collaborators into independent complete rows plus domain metadata', () => {
    const activePersona = persona({
      id: 'pharos',
      assistantAvatarAssetId: 'asset-assistant',
      userAvatarAssetId: 'asset-user',
      version: 5,
      memory: {
        inheritGlobal: true,
        crossConversationRecallEnabled: true,
        conversationSummaries: [],
        excludedGlobalIds: [],
        personalMemories: [],
        referenceDocs: [{
          id: 'doc-1',
          title: 'Reference',
          summary: 'summary',
          content: 'reference body',
          charCount: 14,
          contentLoaded: true,
          source: 'user',
          updatedAt: 40
        }]
      }
    });

    const unit = buildPersonaLocalDataUnitOfWork({
      id: 'persona-migration',
      version: 2,
      updatedAt: 30,
      state: {
        personas: [activePersona],
        activeCollaboratorId: 'pharos',
        seededDefaultPersonaIds: ['pharos']
      }
    });

    expect(unit).toEqual(expect.objectContaining({
      id: 'persona-migration',
      domain: 'persona',
      version: 2
    }));
    expect(unit.mutations).toHaveLength(2);
    expect(unit.mutations[0]).toEqual(expect.objectContaining({
      type: 'put',
      row: expect.objectContaining({
        ref: getPersonaDomainMetaLocalDataRef(),
        value: expect.objectContaining({
          activeCollaboratorId: 'pharos',
          activeObjectCount: 1,
          totalObjectCount: 1,
          seededDefaultPersonaIds: ['pharos']
        })
      })
    }));
    expect(unit.mutations[1]).toEqual(expect.objectContaining({
      type: 'put',
      row: expect.objectContaining({
        ref: getPersonaObjectLocalDataRef('pharos'),
        updatedAt: 40,
        value: expect.objectContaining({
          objectId: toPersonaObjectId('pharos'),
          active: true,
          assetRefs: ['asset-assistant', 'asset-user'],
          referenceDocIds: ['doc-1'],
          referenceDocCount: 1,
          value: expect.objectContaining({
            memory: expect.objectContaining({
              referenceDocs: [expect.objectContaining({
                id: 'doc-1',
                content: 'reference body',
                contentLoaded: true
              })]
            })
          })
        })
      })
    }));
  });
});
