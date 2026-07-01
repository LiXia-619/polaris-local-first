export type FencedCodeBlock = {
  language: string;
  code: string;
  lineCount: number;
};

export type SplitFencedCodeResult = {
  text: string;
  codeBlocks: FencedCodeBlock[];
};

const CLOSED_FENCE_PATTERN = /```([^\n`]*)\n([\s\S]*?)```/g;
const TRAILING_OPEN_FENCE_PATTERN = /```([^\n`]*)\n([\s\S]*)$/;

function pushBlock(codeBlocks: FencedCodeBlock[], language: string, rawCode: string) {
  const code = rawCode.replace(/\n$/, '');
  codeBlocks.push({
    language: language.trim(),
    code,
    lineCount: code ? code.split('\n').length : 0
  });
}

/**
 * 群聊公开层的代码收纳：把围栏代码块从正文里摘出来。
 * 正文（text）进公开气泡，代码块进私域 —— 写代码是过程，群里只出结果。
 */
function defaultCodeMarker(block: FencedCodeBlock) {
  return `〔代码 ${block.lineCount} 行${block.language ? ` · ${block.language}` : ''}〕`;
}

/**
 * 群里其他成员的上下文不需要扛别人的代码原文：
 * 草稿是写的人自己的，成品（卡片）才是大家的。这里把代码块压成占位标记。
 */
export function condenseFencedCode(
  content: string,
  formatMarker: (block: FencedCodeBlock) => string = defaultCodeMarker
): string {
  const { text, codeBlocks } = splitFencedCode(content);
  if (codeBlocks.length === 0) return content;
  const markers = codeBlocks.map((block) => formatMarker(block)).join(' ');
  return text ? `${text}\n${markers}` : markers;
}

export function splitFencedCode(content: string): SplitFencedCodeResult {
  const codeBlocks: FencedCodeBlock[] = [];
  let text = content.replace(CLOSED_FENCE_PATTERN, (_match, language: string, code: string) => {
    pushBlock(codeBlocks, language, code);
    return '';
  });
  // 流式中断等场景留下的未闭合围栏：剩余部分整段按代码收走，别让半截代码糊在群里
  const trailingOpenFence = text.match(TRAILING_OPEN_FENCE_PATTERN);
  if (trailingOpenFence) {
    pushBlock(codeBlocks, trailingOpenFence[1], trailingOpenFence[2]);
    text = text.slice(0, trailingOpenFence.index);
  }
  return {
    text: text.replace(/\n{3,}/g, '\n\n').trim(),
    codeBlocks
  };
}
