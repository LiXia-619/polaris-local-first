import type { Persona } from '../types/domain';
import { POLARIS_ASSISTANT_PERSONA_ID } from '../config/persona/personaBuilder';

export function isCorePersona(persona: Persona | null | undefined): boolean {
  return persona?.systemRole === 'default';
}

export function isPharosPersona(persona: Persona | null | undefined): boolean {
  return persona?.id === 'pharos';
}

export function isProductGuidePersona(persona: Persona | null | undefined): boolean {
  return persona?.id === POLARIS_ASSISTANT_PERSONA_ID;
}

export function canEditPersonaPrompt(persona: Persona | null | undefined): boolean {
  return !isProductGuidePersona(persona) && (!isCorePersona(persona) || isPharosPersona(persona));
}
