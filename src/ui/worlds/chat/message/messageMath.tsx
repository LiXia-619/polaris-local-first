import type { ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const LATEX_RENDER_OPTIONS = {
  throwOnError: false,
  strict: 'ignore',
  trust: false,
  output: 'htmlAndMathml'
} as const;

export function renderLatexNode(
  latex: string,
  displayMode: boolean,
  key: string,
  className?: string
): ReactNode {
  const normalizedLatex = latex.trim();
  const html = katex.renderToString(normalizedLatex, {
    ...LATEX_RENDER_OPTIONS,
    displayMode
  });

  if (displayMode) {
    return (
      <div
        key={key}
        className={['message-markdown-math-block', className].filter(Boolean).join(' ')}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      key={key}
      className={['message-markdown-math-inline', className].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

