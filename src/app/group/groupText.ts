export function oneLine(value: string) {
  const flattened = value.replace(/\s+/g, ' ').trim();
  return flattened.length > 60 ? `${flattened.slice(0, 60)}…` : flattened;
}

// 摘要里不要裸着的 <span> 和 markdown 记号：去壳留字
export function stripInlineMarkup(value: string) {
  return value
    .replace(/<[^<>\n]+>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}
