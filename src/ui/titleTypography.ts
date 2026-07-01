const CJK_TITLE_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

type DisplayTitleClassOptions = {
  systemWhenEmpty?: boolean;
};

export function displayTitleUsesSystemFont(text: string, options: DisplayTitleClassOptions = {}) {
  if (options.systemWhenEmpty && text.trim().length === 0) return true;
  return CJK_TITLE_RE.test(text);
}

export function displayTitleClassName(
  text: string,
  baseClassName = '',
  options: DisplayTitleClassOptions = {}
) {
  const scriptClass = displayTitleUsesSystemFont(text, options)
    ? 'display-title--system'
    : 'display-title--ornamental';

  return [baseClassName, 'display-title', scriptClass].filter(Boolean).join(' ');
}
