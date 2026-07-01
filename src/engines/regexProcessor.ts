export type RegexRuleScope = 'input' | 'output' | 'both';

export interface RegexRule {
  scope: RegexRuleScope;
  pattern: string;
  replacement: string;
  flags?: string;
}

function normalizeRule(raw: unknown): RegexRule | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<RegexRule>;
  if (typeof candidate.pattern !== 'string' || typeof candidate.replacement !== 'string') {
    return null;
  }

  const scope =
    candidate.scope === 'input' || candidate.scope === 'output' || candidate.scope === 'both'
      ? candidate.scope
      : 'both';

  return {
    scope,
    pattern: candidate.pattern,
    replacement: candidate.replacement,
    flags: typeof candidate.flags === 'string' ? candidate.flags : ''
  };
}

function parseLineRule(line: string): RegexRule | null {
  const parts = line.split('|').map((part) => part.trim());
  if (parts.length < 2) return null;

  const [first, second, third = '', fourth = ''] = parts;
  const scoped = first === 'input' || first === 'output' || first === 'both';

  return {
    scope: scoped ? first : 'both',
    pattern: scoped ? second : first,
    replacement: scoped ? third : second,
    flags: scoped ? fourth : third
  };
}

export function parseRegexRules(input: string | undefined): RegexRule[] {
  const trimmed = input?.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeRule(item)).filter((item): item is RegexRule => Boolean(item));
      }
    } catch {
      return [];
    }
  }

  return trimmed
    .split('\n')
    .map((line) => parseLineRule(line.trim()))
    .filter((item): item is RegexRule => Boolean(item));
}

export function applyRegexRules(
  content: string,
  rulesInput: string | RegexRule[] | undefined,
  scope: Exclude<RegexRuleScope, 'both'>
): string {
  const rules = Array.isArray(rulesInput) ? rulesInput : parseRegexRules(rulesInput);

  return rules.reduce((result, rule) => {
    if (rule.scope !== 'both' && rule.scope !== scope) {
      return result;
    }

    try {
      return result.replace(new RegExp(rule.pattern, rule.flags), rule.replacement);
    } catch {
      return result;
    }
  }, content);
}
