import type { AssistantRequestTool } from '../request/requestContext';

const GEMINI_SCHEMA_KEYS = new Set([
  'type',
  'nullable',
  'required',
  'format',
  'description',
  'properties',
  'items',
  'enum'
]);

const GEMINI_UNION_KEYS = ['oneOf', 'anyOf', 'allOf'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pickGeminiUnionVariant(schema: Record<string, unknown>) {
  for (const key of GEMINI_UNION_KEYS) {
    const variants = schema[key];
    if (!Array.isArray(variants)) continue;
    const records = variants.filter(isRecord);
    return records.find((entry) => entry.type === 'string') ?? records[0] ?? null;
  }
  return null;
}

export function sanitizeSchemaForGeminiFunctionDeclaration(schema: Record<string, unknown>): Record<string, unknown> {
  const unionVariant = pickGeminiUnionVariant(schema);
  const source = unionVariant ? { ...schema, ...unionVariant } : schema;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!GEMINI_SCHEMA_KEYS.has(key)) continue;

    if (key === 'properties' && isRecord(value)) {
      sanitized.properties = Object.fromEntries(
        Object.entries(value)
          .filter(([, property]) => isRecord(property))
          .map(([propertyName, property]) => [
            propertyName,
            sanitizeSchemaForGeminiFunctionDeclaration(property as Record<string, unknown>)
          ])
      );
      continue;
    }

    if (key === 'items' && isRecord(value)) {
      sanitized.items = sanitizeSchemaForGeminiFunctionDeclaration(value);
      continue;
    }

    sanitized[key] = value;
  }

  if (!sanitized.type && isRecord(sanitized.properties)) {
    sanitized.type = 'object';
  }

  return sanitized;
}

export function sanitizeToolsForGeminiFunctionDeclarations(
  tools: AssistantRequestTool[]
): AssistantRequestTool[] {
  return tools.map((tool) => ({
    ...tool,
    function: {
      ...tool.function,
      parameters: sanitizeSchemaForGeminiFunctionDeclaration(tool.function.parameters)
    }
  }));
}
