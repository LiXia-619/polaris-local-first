import { useState } from 'react';
import { useI18n } from '../../../../i18n';
import { writeTextToClipboard } from '../../../../infrastructure/clipboard';
import { Icon } from '../../../Icon';
import { runSuccessAction } from '../../../haptics';

type MessageCodeBlockViewProps = {
  code: string;
  language?: string;
  className?: string;
  copyable?: boolean;
};

const CODE_KEYWORDS = new Set([
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'let',
  'new',
  'return',
  'switch',
  'try',
  'type',
  'var',
  'while'
]);

const VALUE_KEYWORDS = new Set(['false', 'null', 'true', 'undefined']);

function isDiffLanguage(language: string | undefined) {
  const normalized = language?.trim().toLowerCase();
  return normalized === 'diff' || normalized === 'patch';
}

function isDiffLikeCode(lines: string[], language: string | undefined) {
  return isDiffLanguage(language)
    || lines.some((line) => line.startsWith('@@') || line.startsWith('+++ ') || line.startsWith('--- '));
}

function classifyDiffLine(line: string, diffLike: boolean) {
  if (!diffLike) return { tone: 'context', marker: null, text: line };
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
    return { tone: 'meta', marker: null, text: line };
  }
  if (line.startsWith('+')) return { tone: 'added', marker: '+', text: line.slice(1) };
  if (line.startsWith('-')) return { tone: 'removed', marker: '-', text: line.slice(1) };
  return { tone: 'context', marker: null, text: line };
}

function syntaxLanguage(language: string | undefined) {
  const normalized = language?.trim().toLowerCase();
  if (!normalized) return 'text';
  if (normalized === 'js' || normalized === 'jsx') return 'javascript';
  if (normalized === 'ts' || normalized === 'tsx') return 'typescript';
  return normalized;
}

function pushPlainToken(tokens: Array<{ text: string; tone: string }>, text: string) {
  if (!text) return;
  tokens.push({ text, tone: 'plain' });
}

function tokenizeGeneric(line: string) {
  const tokens: Array<{ text: string; tone: string }> = [];
  const pattern = /(\/\/.*|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$-]*\b|[{}()[\].,;:+*/%=<>!?&|-])/g;
  let offset = 0;
  for (const match of line.matchAll(pattern)) {
    const text = match[0];
    const index = match.index ?? 0;
    pushPlainToken(tokens, line.slice(offset, index));
    if (text.startsWith('//') || text.startsWith('/*')) {
      tokens.push({ text, tone: 'comment' });
    } else if (text.startsWith('"') || text.startsWith("'") || text.startsWith('`')) {
      tokens.push({ text, tone: 'string' });
    } else if (/^\d/.test(text)) {
      tokens.push({ text, tone: 'number' });
    } else if (CODE_KEYWORDS.has(text)) {
      tokens.push({ text, tone: 'keyword' });
    } else if (VALUE_KEYWORDS.has(text)) {
      tokens.push({ text, tone: 'value' });
    } else if (/^[{}()[\].,;:+*/%=<>!?&|-]$/.test(text)) {
      tokens.push({ text, tone: 'punctuation' });
    } else {
      tokens.push({ text, tone: 'identifier' });
    }
    offset = index + text.length;
  }
  pushPlainToken(tokens, line.slice(offset));
  return tokens;
}

function tokenizeHtml(line: string) {
  const tokens: Array<{ text: string; tone: string }> = [];
  const pattern = /(<!--.*?-->|<\/?[A-Za-z][\w:-]*|[A-Za-z_:][\w:.-]*(?=\=)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[<>/=])/g;
  let offset = 0;
  for (const match of line.matchAll(pattern)) {
    const text = match[0];
    const index = match.index ?? 0;
    pushPlainToken(tokens, line.slice(offset, index));
    if (text.startsWith('<!--')) {
      tokens.push({ text, tone: 'comment' });
    } else if (text.startsWith('<')) {
      tokens.push({ text, tone: 'keyword' });
    } else if (text.startsWith('"') || text.startsWith("'")) {
      tokens.push({ text, tone: 'string' });
    } else if (text === '<' || text === '>' || text === '/' || text === '=') {
      tokens.push({ text, tone: 'punctuation' });
    } else {
      tokens.push({ text, tone: 'property' });
    }
    offset = index + text.length;
  }
  pushPlainToken(tokens, line.slice(offset));
  return tokens;
}

function tokenizeCss(line: string) {
  const tokens: Array<{ text: string; tone: string }> = [];
  const pattern = /(\/\*.*?\*\/|#[\da-fA-F]{3,8}\b|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--[\w-]+|[A-Za-z-]+(?=\s*:)|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms)?\b|[{}():;,.#@>+~*=])/g;
  let offset = 0;
  for (const match of line.matchAll(pattern)) {
    const text = match[0];
    const index = match.index ?? 0;
    pushPlainToken(tokens, line.slice(offset, index));
    if (text.startsWith('/*')) {
      tokens.push({ text, tone: 'comment' });
    } else if (text.startsWith('"') || text.startsWith("'")) {
      tokens.push({ text, tone: 'string' });
    } else if (text.startsWith('#') && text.length > 1) {
      tokens.push({ text, tone: 'number' });
    } else if (text.startsWith('--') || /[A-Za-z-]+/.test(text) && line.slice(index + text.length).trimStart().startsWith(':')) {
      tokens.push({ text, tone: 'property' });
    } else if (/^\d/.test(text)) {
      tokens.push({ text, tone: 'number' });
    } else {
      tokens.push({ text, tone: 'punctuation' });
    }
    offset = index + text.length;
  }
  pushPlainToken(tokens, line.slice(offset));
  return tokens;
}

function tokenizeLine(line: string, language: string | undefined) {
  const normalized = syntaxLanguage(language);
  if (normalized === 'html' || normalized === 'xml' || normalized === 'svg') return tokenizeHtml(line);
  if (normalized === 'css' || normalized === 'scss' || normalized === 'sass' || normalized === 'less') return tokenizeCss(line);
  if (normalized === 'text') return [{ text: line, tone: 'plain' }];
  return tokenizeGeneric(line);
}

export function MessageCodeBlockView({
  code,
  language,
  className,
  copyable = false
}: MessageCodeBlockViewProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');
  const diffLike = isDiffLikeCode(lines, language);
  const rootClassName = ['message-code-lines', copyable ? 'copyable' : null, className].filter(Boolean).join(' ');

  const copyCode = async () => {
    if (!copyable || !code.trim()) return;
    await runSuccessAction(() => writeTextToClipboard(code));
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1400);
  };

  return (
    <pre className={rootClassName}>
      {copyable ? (
        <button
          type="button"
          className={`message-code-block-copy ${copied ? 'copied' : ''}`}
          onClick={() => { void copyCode(); }}
          aria-label={copied ? t('chat.code.copied') : t('chat.code.copy')}
          title={copied ? t('chat.code.copied') : t('chat.code.copy')}
        >
          <Icon name="copy" size={13} />
        </button>
      ) : null}
      <code>
        {lines.map((line, index) => {
          const classified = classifyDiffLine(line, diffLike);
          const marker = classified.marker ?? String(index + 1);

          return (
            <span
              key={`line-${index}`}
              className={`message-code-line tone-${classified.tone}`}
            >
              <span className="message-code-line-marker">{marker}</span>
              <span className="message-code-line-text">
                {classified.text
                  ? tokenizeLine(classified.text, language).map((token, tokenIndex) => (
                    token.tone === 'plain'
                      ? token.text
                      : <span key={`token-${index}-${tokenIndex}`} className={`syntax-${token.tone}`}>{token.text}</span>
                  ))
                  : ' '}
              </span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}
