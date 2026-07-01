const RAW_TEXT_FIELD_NAMES = ['cssText', 'code', 'content', 'html'] as const;

export function normalizeToolJson(raw: string): string {
  return raw
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, '\'')
    .replace(/，/g, ',')
    .replace(/：/g, ':')
    .replace(/^\s*json\s*/i, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*#.*$/gm, '');
}

function quoteBareKeys(input: string): string {
  let output = '';
  let index = 0;
  let inString = false;
  let quoteChar = '';
  let escaped = false;

  while (index < input.length) {
    const char = input[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quoteChar) {
        inString = false;
        quoteChar = '';
      }
      index += 1;
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      quoteChar = char;
      output += char;
      index += 1;
      continue;
    }

    if (char === '{' || char === ',') {
      output += char;
      index += 1;

      while (index < input.length && /\s/.test(input[index])) {
        output += input[index];
        index += 1;
      }

      const rest = input.slice(index);
      const match = rest.match(/^([A-Za-z_][\w-]*)(\s*:)/);
      if (match) {
        output += `"${match[1]}"${match[2]}`;
        index += match[0].length;
      }
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

function replaceSingleQuotedStrings(input: string): string {
  return input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value: string) => {
    const normalized = value.replace(/"/g, '\\"');
    return `"${normalized}"`;
  });
}

function stripTrailingCommas(input: string): string {
  return input.replace(/,\s*([}\]])/g, '$1');
}

function escapeJsonStringContent(value: string) {
  return JSON.stringify(value).slice(1, -1);
}

function unwrapMarkdownFence(value: string) {
  return value
    .replace(/^```[A-Za-z0-9_-]*\s*\n?/, '')
    .replace(/\n?```$/, '');
}

function wrapFencedFieldValues(input: string): string {
  return RAW_TEXT_FIELD_NAMES.reduce((current, fieldName) => {
    const pattern = new RegExp(`("${fieldName}"\\s*:\\s*)(\`\`\`[A-Za-z0-9_-]*\\s*[\\s\\S]*?\`\`\`)`, 'g');
    return current.replace(pattern, (_match, prefix: string, fencedValue: string) => {
      const content = unwrapMarkdownFence(fencedValue);
      return `${prefix}"${escapeJsonStringContent(content)}"`;
    });
  }, input);
}

function escapeMultilineQuotedFieldValues(input: string): string {
  return RAW_TEXT_FIELD_NAMES.reduce((current, fieldName) => {
    const pattern = new RegExp(`("${fieldName}"\\s*:\\s*")([\\s\\S]*?)("(?=\\s*(?:,\\s*"[A-Za-z_][\\w-]*"\\s*:|}|\\])))`, 'g');
    return current.replace(pattern, (_match, prefix: string, content: string, suffix: string) => {
      return `${prefix}${escapeJsonStringContent(content)}${suffix}`;
    });
  }, input);
}

function wrapLooseTextFieldValues(input: string): string {
  return RAW_TEXT_FIELD_NAMES.reduce((current, fieldName) => {
    const pattern = new RegExp(`("${fieldName}"\\s*:\\s*)([^"\\[{][\\s\\S]*?)(?=\\s*(?:,\\s*"[A-Za-z_][\\w-]*"\\s*:|}|\\]))`, 'g');
    return current.replace(pattern, (_match, prefix: string, content: string) => {
      return `${prefix}"${escapeJsonStringContent(content.trim())}"`;
    });
  }, input);
}

function extractJsonEnvelope(input: string): string | null {
  const objectStart = input.indexOf('{');
  const objectEnd = input.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    return input.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = input.indexOf('[');
  const arrayEnd = input.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return input.slice(arrayStart, arrayEnd + 1);
  }

  return null;
}

export function parseToolPayload(rawJson: string): unknown {
  const trimmed = rawJson.trim();
  const extractedEnvelope = extractJsonEnvelope(trimmed);
  const normalized = normalizeToolJson(trimmed);
  const normalizedEnvelope = extractedEnvelope ? normalizeToolJson(extractedEnvelope) : null;
  const baseCandidates = [
    trimmed,
    extractedEnvelope,
    normalized,
    stripTrailingCommas(normalized),
    replaceSingleQuotedStrings(stripTrailingCommas(normalized)),
    quoteBareKeys(replaceSingleQuotedStrings(stripTrailingCommas(normalized))),
    normalizedEnvelope,
    normalizedEnvelope ? stripTrailingCommas(normalizedEnvelope) : null,
    normalizedEnvelope ? replaceSingleQuotedStrings(stripTrailingCommas(normalizedEnvelope)) : null,
    normalizedEnvelope
      ? quoteBareKeys(replaceSingleQuotedStrings(stripTrailingCommas(normalizedEnvelope)))
      : null
  ];
  const repairedCandidates = baseCandidates.flatMap((candidate) => {
    if (!candidate) return [];
    const withFencedFields = wrapFencedFieldValues(candidate);
    const withLooseFields = wrapLooseTextFieldValues(withFencedFields);
    const escapedFields = escapeMultilineQuotedFieldValues(withLooseFields);
    return [
      candidate,
      withFencedFields,
      withLooseFields,
      escapedFields,
      stripTrailingCommas(escapedFields)
    ];
  });
  const attempts = [
    ...new Set(repairedCandidates.filter((value): value is string => Boolean(value)))
  ];

  let lastError: unknown = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('tool json parse failed');
}
