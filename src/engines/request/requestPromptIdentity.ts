import { resolveSystemPromptVars, type TemplateContext } from '../templateEngine';
import type { AssistantPromptPart, PersonaRuntimePromptSource } from './requestAudit';

type IdentityPromptGroup = {
  name: Extract<AssistantPromptPart['name'], 'persona_identity_core' | 'persona_identity_motive' | 'persona_identity_style'>;
  label: string;
  headings: string[];
};

const VNEXT_IDENTITY_GROUPS: IdentityPromptGroup[] = [
  { name: 'persona_identity_core', label: '核心身份', headings: ['[核心身份]', '[关系骨架]'] },
  { name: 'persona_identity_motive', label: '关系与动机', headings: ['[认知风味]', '[深层动机]'] },
  { name: 'persona_identity_style', label: '语言与边界', headings: ['[语言质地]', '[边界]'] }
];

const BUILTIN_IDENTITY_GROUPS: IdentityPromptGroup[] = [
  { name: 'persona_identity_core', label: '核心身份', headings: ['## 核心身份', '## 人格四柱'] },
  { name: 'persona_identity_motive', label: '互动与表达', headings: ['## 互动宽度', '## 语言纪律'] },
  { name: 'persona_identity_style', label: '边界与存在', headings: ['## 底线', '## 存在论'] }
];

function splitPromptByHeadings(content: string, headings: string[]): Map<string, string> | null {
  const knownHeadings = new Set(headings);
  const sections = new Map<string, string[]>();
  const prelude: string[] = [];
  let currentHeading: string | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (knownHeadings.has(trimmed)) {
      currentHeading = trimmed;
      sections.set(trimmed, [line]);
      continue;
    }

    if (!currentHeading) {
      prelude.push(line);
      continue;
    }

    sections.get(currentHeading)?.push(line);
  }

  if (!headings.every((heading) => sections.has(heading))) {
    return null;
  }

  if (prelude.some((line) => line.trim()) && headings[0]) {
    sections.set(headings[0], [...prelude, '', ...(sections.get(headings[0]) ?? [])]);
  }

  return new Map(headings.map((heading) => [heading, (sections.get(heading) ?? []).join('\n').trim()]));
}

export function buildIdentityEntries(args: {
  personaPrompt: string;
  personaPromptSource: PersonaRuntimePromptSource;
  templateContext: TemplateContext;
}): Array<Omit<AssistantPromptPart, 'enabled' | 'charCount'>> {
  const resolvedPrompt = resolveSystemPromptVars(args.personaPrompt, args.templateContext).trim();
  const groups =
    args.personaPromptSource === 'vnext'
      ? VNEXT_IDENTITY_GROUPS
      : args.personaPromptSource === 'builtin'
        ? BUILTIN_IDENTITY_GROUPS
        : null;

  if (!groups) {
    return [{
      name: 'persona_identity',
      label: '人格设定',
      role: 'system',
      layer: 'identity',
      truncationPriority: 0,
      content: resolvedPrompt
    }];
  }

  const sections = splitPromptByHeadings(resolvedPrompt, groups.flatMap((group) => group.headings));
  if (!sections) {
    return [{
      name: 'persona_identity',
      label: '人格设定',
      role: 'system',
      layer: 'identity',
      truncationPriority: 0,
      content: resolvedPrompt
    }];
  }

  return groups.map((group) => ({
    name: group.name,
    label: group.label,
    role: 'system',
    layer: 'identity',
    truncationPriority: group.name === 'persona_identity_core' ? 0 : 1,
    content: group.name === 'persona_identity_core'
      ? group.headings.map((heading) => sections.get(heading) ?? '').filter(Boolean).join('\n\n').trim()
      : group.headings.map((heading) => sections.get(heading) ?? '').filter(Boolean).join('\n\n').trim()
  }));
}
