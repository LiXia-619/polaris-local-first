function readObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readNumberString(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function compactErrorParts(parts: unknown[]) {
  return parts
    .map((part) => readString(part) || readNumberString(part))
    .filter(Boolean)
    .join(' | ');
}

function extractNestedError(error: unknown) {
  const body = readObject(error);
  if (!body) return '';
  return compactErrorParts([
    body.message,
    body.error,
    body.type,
    body.code,
    body.status,
    body.reason
  ]);
}

export function extractProviderErrorMessage(payload: unknown) {
  const body = readObject(payload);
  if (!body) return '';

  const directError = extractNestedError(body.error);
  const response = readObject(body.response);
  const responseError = extractNestedError(response?.error);
  const directMessage = compactErrorParts([
    body.message,
    body.reason,
    body.error_description
  ]);
  const hasErrorShape = Boolean(
    directError
    || responseError
    || directMessage
    || body.status_code
    || body.statusCode
  );

  if (!hasErrorShape) return '';

  return compactErrorParts([
    directError,
    responseError,
    directMessage,
    body.status_code,
    body.statusCode,
    body.code,
    body.status,
    body.type
  ]);
}

export function formatRawProviderResponseSnippet(rawResponseText: string) {
  return rawResponseText
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 260);
}

export function formatEmptyProviderResponseMessage(rawResponseText: string) {
  const rawSnippet = formatRawProviderResponseSnippet(rawResponseText);
  if (!rawSnippet) return 'API 返回为空';
  if (/\b(status_code|http\s+\d{3}|invalid_model_id|invalid model)\b|error[:=]/i.test(rawSnippet)) {
    return rawSnippet;
  }
  return `API 返回为空：${rawSnippet}`;
}

export function formatProviderPayloadSnippet(payload: unknown) {
  try {
    return formatRawProviderResponseSnippet(JSON.stringify(payload));
  } catch {
    return '';
  }
}
