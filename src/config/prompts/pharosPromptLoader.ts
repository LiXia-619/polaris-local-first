let pharosPromptPromise: Promise<string> | null = null;

export function loadPharosPersonaPrompt(): Promise<string> {
  if (!pharosPromptPromise) {
    pharosPromptPromise = import('./pharosPrompt').then((module) => module.PHAROS_PERSONA_PROMPT);
  }

  return pharosPromptPromise;
}
