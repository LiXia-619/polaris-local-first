import { describe, expect, it } from 'vitest';
import { DEFAULT_PERSONAS, POLARIS_ASSISTANT_PERSONA_ID } from '../config/persona/personaBuilder';
import { canEditPersonaPrompt, isProductGuidePersona } from './personaBuiltin';

describe('personaBuiltin', () => {
  it('locks the built-in product guide prompt', () => {
    const assistant = DEFAULT_PERSONAS.find((persona) => persona.id === POLARIS_ASSISTANT_PERSONA_ID);

    expect(isProductGuidePersona(assistant)).toBe(true);
    expect(canEditPersonaPrompt(assistant)).toBe(false);
  });

  it('keeps Pharos editable even though it is built in', () => {
    const pharos = DEFAULT_PERSONAS.find((persona) => persona.id === 'pharos');

    expect(canEditPersonaPrompt(pharos)).toBe(true);
  });
});
