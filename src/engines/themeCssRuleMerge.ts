type CssDeclaration = { property: string; value: string };

type ParsedCssRule = {
  selector: string;
  bodyText: string;
  declarations: CssDeclaration[] | null;
  rawText: string;
};

export type SimpleCssRule = Pick<ParsedCssRule, 'selector' | 'bodyText' | 'rawText'>;

function skipCommentBlock(source: string, index: number) {
  const commentEnd = source.indexOf('*/', index + 2);
  return commentEnd === -1 ? source.length : commentEnd + 2;
}

function skipQuotedText(source: string, index: number) {
  const quote = source[index];
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote) {
      return cursor + 1;
    }
    cursor += 1;
  }
  return source.length;
}

function skipIgnorableCss(source: string, index: number) {
  let cursor = index;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    if (source[cursor] === '/' && source[cursor + 1] === '*') {
      cursor = skipCommentBlock(source, cursor);
      continue;
    }
    break;
  }
  return cursor;
}

function parseCssDeclarations(declarationText: string): CssDeclaration[] | null {
  const declarations: CssDeclaration[] = [];
  const entries: string[] = [];
  let cursor = 0;
  let current = '';
  let parenDepth = 0;

  while (cursor < declarationText.length) {
    const char = declarationText[cursor];
    if (char === '/' && declarationText[cursor + 1] === '*') {
      cursor = skipCommentBlock(declarationText, cursor);
      continue;
    }
    if (char === '"' || char === '\'') {
      const nextCursor = skipQuotedText(declarationText, cursor);
      current += declarationText.slice(cursor, nextCursor);
      cursor = nextCursor;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      current += char;
      cursor += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += char;
      cursor += 1;
      continue;
    }
    if (char === ';' && parenDepth === 0) {
      if (current.trim()) {
        entries.push(current.trim());
      }
      current = '';
      cursor += 1;
      continue;
    }
    current += char;
    cursor += 1;
  }

  if (current.trim()) {
    entries.push(current.trim());
  }

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex === -1) return null;
    const property = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!property || !value) return null;
    declarations.push({ property, value });
  }

  return declarations.length ? declarations : null;
}

function parseSimpleCssRules(cssText: string): ParsedCssRule[] | null {
  const source = cssText.trim();
  if (!source) return null;
  const rules: ParsedCssRule[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    cursor = skipIgnorableCss(source, cursor);
    if (cursor >= source.length) break;

    const selectorStart = cursor;
    while (cursor < source.length) {
      const char = source[cursor];
      if (char === '/' && source[cursor + 1] === '*') {
        cursor = skipCommentBlock(source, cursor);
        continue;
      }
      if (char === '"' || char === '\'') {
        cursor = skipQuotedText(source, cursor);
        continue;
      }
      if (char === '{') break;
      cursor += 1;
    }

    if (cursor >= source.length || source[cursor] !== '{') {
      return null;
    }

    const selector = source.slice(selectorStart, cursor).trim();
    cursor += 1;
    const bodyStart = cursor;
    let depth = 1;
    let hasNestedBlocks = false;

    while (cursor < source.length && depth > 0) {
      const char = source[cursor];
      if (char === '/' && source[cursor + 1] === '*') {
        cursor = skipCommentBlock(source, cursor);
        continue;
      }
      if (char === '"' || char === '\'') {
        cursor = skipQuotedText(source, cursor);
        continue;
      }
      if (char === '{') {
        hasNestedBlocks = true;
        depth += 1;
        cursor += 1;
        continue;
      }
      if (char === '}') {
        depth -= 1;
        cursor += 1;
        continue;
      }
      cursor += 1;
    }

    if (depth !== 0) {
      return null;
    }

    const declarationText = source.slice(bodyStart, cursor - 1).trim();
    if (!selector || !declarationText) {
      return null;
    }

    const declarations = !hasNestedBlocks && !selector.startsWith('@')
      ? parseCssDeclarations(declarationText)
      : null;

    rules.push({
      selector,
      bodyText: declarationText,
      declarations,
      rawText: `${selector} {\n${declarationText}\n}`
    });
  }

  return rules.length ? rules : null;
}

export function readSimpleCssRules(cssText: string): SimpleCssRule[] | null {
  return parseSimpleCssRules(cssText)?.map(({ selector, bodyText, rawText }) => ({
    selector,
    bodyText,
    rawText
  })) ?? null;
}

export function mergeSimpleCssRules(baseCss: string, nextCss: string): string | null {
  const baseRules = parseSimpleCssRules(baseCss);
  const nextRules = parseSimpleCssRules(nextCss);
  if (!baseRules || !nextRules) return null;

  const mergedRules = baseRules.map((rule) => ({
    selector: rule.selector,
    bodyText: rule.bodyText,
    declarations: rule.declarations ? rule.declarations.map((declaration) => ({ ...declaration })) : null,
    rawText: rule.rawText
  }));

  nextRules.forEach((rule) => {
    const existingIndex = mergedRules.findIndex((entry) => entry.selector === rule.selector);
    if (existingIndex === -1) {
      mergedRules.push({
        selector: rule.selector,
        bodyText: rule.bodyText,
        declarations: rule.declarations ? rule.declarations.map((declaration) => ({ ...declaration })) : null,
        rawText: rule.rawText
      });
      return;
    }

    const existing = mergedRules[existingIndex];
    if (!existing.declarations || !rule.declarations) {
      const mergedNestedCss =
        existing.selector === rule.selector && existing.bodyText.trim() && rule.bodyText.trim()
          ? mergeSimpleCssRules(existing.bodyText, rule.bodyText)
          : null;

      if (mergedNestedCss) {
        mergedRules[existingIndex] = {
          selector: rule.selector,
          bodyText: mergedNestedCss,
          declarations: null,
          rawText: `${rule.selector} {\n${mergedNestedCss}\n}`
        };
        return;
      }

      mergedRules[existingIndex] = {
        selector: rule.selector,
        bodyText: rule.bodyText,
        declarations: rule.declarations ? rule.declarations.map((declaration) => ({ ...declaration })) : null,
        rawText: rule.rawText
      };
      return;
    }

    const declarationMap = new Map(existing.declarations.map((declaration) => [declaration.property, declaration.value]));
    const declarationOrder = existing.declarations.map((declaration) => declaration.property);

    rule.declarations.forEach((declaration) => {
      if (!declarationMap.has(declaration.property)) {
        declarationOrder.push(declaration.property);
      }
      declarationMap.set(declaration.property, declaration.value);
    });

    existing.declarations = declarationOrder.map((property) => ({
      property,
      value: declarationMap.get(property) as string
    }));
  });

  return mergedRules
    .map((rule) => {
      if (!rule.declarations) return rule.rawText.trim();
      const declarations = rule.declarations
        .map((declaration) => `${declaration.property}: ${declaration.value};`)
        .join('\n');
      return `${rule.selector} {\n${declarations}\n}`;
    })
    .filter(Boolean)
    .join('\n\n');
}
