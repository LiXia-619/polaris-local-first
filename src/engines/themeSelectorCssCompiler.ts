import { resolveFromCatalog } from '../config/theme/themeSelectorCatalog';

type SelectorCssCompileResult =
  | {
      ok: true;
      selector: string;
      cssText: string;
    }
  | {
      ok: false;
      error: string;
    };

function normalizeSelector(selector: string): string | null {
  const normalized = selector.trim();
  if (!normalized) return null;
  if (/[{}]/.test(normalized)) return null;

  const tokens = normalized
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length) return null;

  const selectors: string[] = [];
  for (const token of tokens) {
    const resolvedSelectors = resolveFromCatalog(token);
    if (resolvedSelectors?.length) {
      selectors.push(...resolvedSelectors);
      continue;
    }

    selectors.push(token);
  }

  return Array.from(new Set(selectors)).join(',\n');
}

function extractSingleCssRule(cssText: string): { selector: string; declarations: string } | null {
  const trimmed = cssText.trim();
  const match = trimmed.match(/^([^{}]+)\{([\s\S]*)\}$/);
  if (!match) return null;
  const [, selector, declarations] = match;
  if (!selector.trim() || !declarations.trim()) return null;
  if (/[{}]/.test(selector) || /[{}]/.test(declarations)) return null;
  return {
    selector: selector.trim(),
    declarations: declarations.trim()
  };
}

function extractFirstCssRule(cssText: string): { selector: string; declarations: string } | null {
  const trimmed = cssText.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/([^{}]+)\{([^{}]*)\}/);
  if (!match) return null;

  const [, selector, declarations] = match;
  if (!selector.trim() || !declarations.trim()) return null;

  return {
    selector: selector.trim(),
    declarations: declarations.trim()
  };
}

function normalizeDeclarationBlock(cssText: string): string | null {
  const trimmed = cssText.trim();
  if (!trimmed) return null;

  const extractedRule = extractSingleCssRule(trimmed);
  if (extractedRule) {
    return normalizeDeclarationBlock(extractedRule.declarations);
  }

  const firstRule = extractFirstCssRule(trimmed);
  if (firstRule) {
    return normalizeDeclarationBlock(firstRule.declarations);
  }

  const unwrapped = trimmed.startsWith('{') && trimmed.endsWith('}')
    ? trimmed.slice(1, -1).trim()
    : trimmed;
  if (!unwrapped) return null;
  if (/[{}]/.test(unwrapped)) return null;
  if (!unwrapped.includes(':')) return null;

  const lines = unwrapped
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  return lines
    .map((line) => (line.endsWith(';') ? line : `${line};`))
    .join('\n');
}

export function compileThemeSelectorCssAction(args: {
  selector: string;
  cssText: string;
}): SelectorCssCompileResult {
  const extractedRule = extractSingleCssRule(args.cssText);
  const normalizedSelector = normalizeSelector(args.selector || extractedRule?.selector || '');
  if (!normalizedSelector) {
    return { ok: false, error: 'selector 不能为空；可以单独写 selector，也可以在 cssText 里给一条完整规则。' };
  }

  const declarations = normalizeDeclarationBlock(args.cssText);
  if (!declarations) {
    return { ok: false, error: 'selector CSS 需要声明块；如果你给了一条完整规则，系统会自动提取其中的声明。' };
  }

  return {
    ok: true,
    selector: normalizedSelector,
    cssText: `${normalizedSelector} {\n${declarations}\n}`
  };
}
