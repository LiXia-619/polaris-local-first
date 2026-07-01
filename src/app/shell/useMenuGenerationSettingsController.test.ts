import { describe, expect, it } from 'vitest';
import type { MemoryVectorRetrievalSettings, PersonaMemorySettings } from '../../types/domain';
import { isMenuMemorySearchAvailable } from './useMenuGenerationSettingsController';

function memoryVectorRetrieval(enabled: boolean): MemoryVectorRetrievalSettings {
  return {
    enabled,
    baseUrl: '',
    path: '/embeddings',
    apiKey: '',
    model: '',
    dimensions: null
  };
}

function personaMemory(patch: Partial<PersonaMemorySettings> = {}): PersonaMemorySettings {
  return {
    inheritGlobal: true,
    crossConversationRecallEnabled: true,
    conversationSummaries: [],
    excludedGlobalIds: [],
    personalMemories: [],
    referenceDocs: [],
    ...patch
  };
}

function persona(memory: PersonaMemorySettings = personaMemory()): { memory: PersonaMemorySettings } {
  return { memory };
}

describe('menu generation settings controller', () => {
  it('keeps memory search unavailable when no persona is active', () => {
    expect(isMenuMemorySearchAvailable(null, memoryVectorRetrieval(true))).toBe(false);
  });

  it('enables memory search when the active persona allows recall', () => {
    expect(isMenuMemorySearchAvailable(persona(), memoryVectorRetrieval(false))).toBe(true);
  });

  it('disables memory search when the active persona disables recall and vector retrieval is off', () => {
    expect(isMenuMemorySearchAvailable(
      persona(personaMemory({ crossConversationRecallEnabled: false })),
      memoryVectorRetrieval(false)
    )).toBe(false);
  });

  it('allows vector retrieval to make memory search available for the active persona', () => {
    expect(isMenuMemorySearchAvailable(
      persona(personaMemory({ crossConversationRecallEnabled: false })),
      memoryVectorRetrieval(true)
    )).toBe(true);
  });
});
