import type { ToolCodeWriteDetail, ToolInvocation } from '../../../../types/domain';

const THEME_CODE_WRITE_KINDS = new Set<ToolInvocation['kind']>([
  'patchRawCss',
  'appendThemeCss',
  'insertThemeCss',
  'editThemeCss',
  'deleteThemeCss',
  'replaceThemeCss'
]);

function countLines(value: string) {
  const text = value.trim();
  return text ? text.split(/\r\n|\r|\n/).length : 0;
}

function fallbackThemeWriteDetail(tool: ToolInvocation): ToolCodeWriteDetail | null {
  const code = tool.detailText?.trim();
  if (!code || !THEME_CODE_WRITE_KINDS.has(tool.kind)) return null;
  const removedLines = tool.kind === 'deleteThemeCss' ? countLines(code) : 0;
  return {
    label: tool.targetLabel?.trim() || tool.themeIntentLabel?.trim() || 'theme.css',
    language: 'css',
    code,
    addedLines: tool.kind === 'deleteThemeCss' ? 0 : countLines(code),
    removedLines
  };
}

export function buildToolWriteDetailBlocks(tool: ToolInvocation): ToolCodeWriteDetail[] {
  const details = tool.codeWriteDetails?.filter((item) => item.code.trim()) ?? [];
  if (details.length) return details;

  const themeDetail = fallbackThemeWriteDetail(tool);
  return themeDetail ? [themeDetail] : [];
}

export function formatLineDelta(detail: Pick<ToolCodeWriteDetail, 'addedLines' | 'removedLines'>) {
  return `+${detail.addedLines} -${detail.removedLines}`;
}
