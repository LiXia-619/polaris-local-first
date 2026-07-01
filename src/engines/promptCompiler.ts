import { isPharosPersona } from './personaBuiltin';
import { loadPharosPersonaPrompt } from '../config/prompts/pharosPromptLoader';
import { normalizePersonaPromptBase } from '../config/persona/personaPromptCopy';
import { buildGeneratedPersonaPrompt } from './personaCompiler';
import type { PersonaRuntimePromptSource } from './request/requestAudit';
import type { Persona } from '../types/domain';

function buildPersonaToneSnippetSection(persona: Persona | null | undefined) {
  const snippets = persona?.advanced.snippets
    ?.map((snippet) => snippet.trim())
    .filter(Boolean) ?? [];
  if (!snippets.length) return '';

  return ['[语气偏好]', ...snippets.map((snippet) => `- ${snippet}`)].join('\n');
}

function buildPersonaNameAnchor(persona: Persona | null | undefined) {
  if (!persona) return '';
  if (normalizePersonaPromptBase(persona.baseId) === 'null') return '';
  const name = persona.name.trim();
  if (!name) return '';

  return ['[名字]', `你在这间房里的名字是：${name}。`].join('\n');
}

function attachPersonaNameAnchor(prompt: string, persona: Persona | null | undefined) {
  const trimmedPrompt = prompt.trim();
  const nameAnchor = buildPersonaNameAnchor(persona);
  if (!nameAnchor) {
    return trimmedPrompt;
  }
  if (trimmedPrompt.includes(nameAnchor)) {
    return trimmedPrompt;
  }
  return [nameAnchor, trimmedPrompt].filter(Boolean).join('\n\n');
}

function attachPersonaToneSnippets(prompt: string, persona: Persona | null | undefined) {
  const trimmedPrompt = prompt.trim();
  const toneSection = buildPersonaToneSnippetSection(persona);
  if (!toneSection) {
    return trimmedPrompt;
  }
  if (trimmedPrompt.includes(toneSection)) {
    return trimmedPrompt;
  }
  return [trimmedPrompt, toneSection].filter(Boolean).join('\n\n');
}

function finalizeRuntimePrompt(prompt: string, persona: Persona | null | undefined) {
  return attachPersonaToneSnippets(attachPersonaNameAnchor(prompt, persona), persona);
}

export async function resolvePersonaPromptForRuntimeSpec(
  persona: Persona | null | undefined
): Promise<{
  prompt: string;
  source: PersonaRuntimePromptSource;
}> {
  if (!persona) {
    return { prompt: '', source: 'none' };
  }

  const customPrompt = persona.compiledPrompt?.trim();
  if (customPrompt) {
    return { prompt: finalizeRuntimePrompt(customPrompt, persona), source: 'custom' };
  }

  if (isPharosPersona(persona)) {
    return {
      prompt: finalizeRuntimePrompt(await loadPharosPersonaPrompt(), persona),
      source: 'builtin'
    };
  }

  if (persona.generatedPromptMode === 'off') {
    return { prompt: '', source: 'none' };
  }

  return {
    prompt: finalizeRuntimePrompt(buildGeneratedPersonaPrompt(persona), persona),
    source: 'vnext'
  };
}

export function getPersonaPromptVariants(persona: Persona | null | undefined) {
  if (!persona) {
    return {
      customPrompt: '',
      compiledPrompt: '',
      effectivePrompt: '',
      effectiveSource: 'vnext' as const,
      runtimeNote: '当前没有可用 persona。'
    };
  }

  const customPrompt = persona.compiledPrompt?.trim() ?? '';
  const generatedPromptEnabled = persona.generatedPromptMode !== 'off';
  const compiledPrompt = generatedPromptEnabled ? buildGeneratedPersonaPrompt(persona) : '';
  const effectivePrompt = customPrompt
    ? finalizeRuntimePrompt(customPrompt, persona)
    : generatedPromptEnabled
      ? finalizeRuntimePrompt(compiledPrompt, persona)
      : '';

  return {
    customPrompt,
    compiledPrompt,
    effectivePrompt,
    effectiveSource: customPrompt ? ('custom' as const) : generatedPromptEnabled ? ('vnext' as const) : ('none' as const),
    runtimeNote: customPrompt
      ? '当前主运行时优先使用你手写或保存过的 compiledPrompt。'
      : generatedPromptEnabled
        ? '当前主运行时直接使用 VNext 编译结果。'
        : '当前主运行时不注入协作者人格提示词。'
  };
}
