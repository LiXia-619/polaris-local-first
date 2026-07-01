const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  yml: 'yaml'
};

export function normalizeCodeLanguage(value: string | undefined): string {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return 'text';
  return LANGUAGE_ALIASES[raw] ?? raw;
}

function looksLikeJson(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed || !/^[{\[]/.test(trimmed)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function inferCodeLanguage(code: string, preferredLanguage?: string): string {
  const normalizedPreferred = normalizeCodeLanguage(preferredLanguage);
  if (normalizedPreferred !== 'text') return normalizedPreferred;

  const trimmed = code.trim();
  if (!trimmed) return normalizedPreferred;

  if (
    /<!doctype html>/i.test(trimmed) ||
    /<\/?[a-z][\w:-]*(\s[^>]*?)?>/i.test(trimmed)
  ) {
    return 'html';
  }

  if (looksLikeJson(trimmed)) {
    return 'json';
  }

  if (
    /(^|\n)\s*(@media|@keyframes|:root\b)/.test(trimmed) ||
    /(^|\n)\s*[.#]?[a-z][\w-]*(\s+[a-z][\w-]*)?\s*\{/.test(trimmed) ||
    /(^|\n)\s*--[\w-]+\s*:/.test(trimmed)
  ) {
    return 'css';
  }

  if (
    /(^|\n)\s*(interface|type)\s+[A-Z][\w]*/.test(trimmed) ||
    /(^|\n)\s*(export\s+)?(const|let|function)\s+\w+\s*(<[^>]+>)?\s*\([^)]*:\s*[\w[\]<>{}| ,]+/.test(trimmed) ||
    /\sas const\b/.test(trimmed) ||
    /:\s*(string|number|boolean|Record|Array|unknown|never|React\.)/.test(trimmed)
  ) {
    return 'typescript';
  }

  if (
    /(^|\n)\s*(import|export)\b/.test(trimmed) ||
    /(^|\n)\s*(const|let|var)\s+\w+\s*=/.test(trimmed) ||
    /(^|\n)\s*function\s+\w+/.test(trimmed) ||
    /=>/.test(trimmed)
  ) {
    return 'javascript';
  }

  if (
    /(^|\n)\s*def\s+\w+/.test(trimmed) ||
    /(^|\n)\s*(from\s+\w+\s+import|import\s+\w+)/.test(trimmed)
  ) {
    return 'python';
  }

  if (
    /(^|\n)\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(trimmed)
  ) {
    return 'sql';
  }

  if (
    /^---\s*$/m.test(trimmed) ||
    /(^|\n)\s*[\w-]+\s*:\s*.+/.test(trimmed)
  ) {
    return 'yaml';
  }

  if (
    /(^|\n)\s*#\s+/.test(trimmed) ||
    /(^|\n)\s*[-*]\s+/.test(trimmed) ||
    /(^|\n)\s*```/.test(trimmed)
  ) {
    return 'markdown';
  }

  return normalizedPreferred;
}
