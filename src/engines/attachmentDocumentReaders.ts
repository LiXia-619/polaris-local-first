import { createStoredAttachment } from '../infrastructure/assetStore';
import { readPdfText } from './pdfTextReader';
import type { ChatAttachment } from '../types/domain';

const MAX_DOCUMENT_CHARS = 120_000;

const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const PDF_MIME_TYPES = new Set(['application/pdf']);

function getExtension(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function truncateDocumentText(text: string) {
  const normalized = text.replace(/\r/g, '').replace(/\u0000/g, '').trim();
  if (!normalized) {
    return { text: '', truncated: false };
  }

  if (normalized.length <= MAX_DOCUMENT_CHARS) {
    return { text: normalized, truncated: false };
  }

  return {
    text: normalized.slice(0, MAX_DOCUMENT_CHARS).trim(),
    truncated: true
  };
}

function summarizeDocumentText(kind: 'pdf' | 'docx', text: string, truncated: boolean) {
  return [
    kind === 'pdf' ? '已从 PDF 中提取可读文字，原始排版可能会丢一点。' : '已从 DOCX 中提取正文内容。',
    truncated ? '内容已按体积截断。' : '',
    '',
    text
  ]
    .filter(Boolean)
    .join('\n');
}

function nodeLocalName(node: Element) {
  return node.localName || node.tagName.split(':').pop() || '';
}

function extractDocxParagraphText(paragraph: Element) {
  let text = '';
  const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current: Node | null = paragraph;

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      text += current.textContent ?? '';
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element;
      const name = nodeLocalName(element);
      if (name === 'tab') {
        text += '\t';
      } else if (name === 'br' || name === 'cr') {
        text += '\n';
      }
    }
    current = walker.nextNode();
  }

  return text.replace(/\u00a0/g, ' ').trim();
}

async function readDocxText(buffer: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const xmlEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (xmlEntries.length === 0) {
    return '';
  }

  const parser = new DOMParser();
  const sections: string[] = [];

  for (const entry of xmlEntries) {
    const xmlText = await entry.async('string');
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const paragraphs = Array.from(doc.getElementsByTagName('*'))
      .filter((element) => nodeLocalName(element) === 'p')
      .map(extractDocxParagraphText)
      .filter(Boolean);

    if (paragraphs.length > 0) {
      sections.push(paragraphs.join('\n\n'));
    }
  }

  return sections.join('\n\n').trim();
}

export function isDocxFile(file: File) {
  return DOCX_MIME_TYPES.has(file.type) || getExtension(file.name) === 'docx';
}

export function isPdfFile(file: File) {
  return PDF_MIME_TYPES.has(file.type) || getExtension(file.name) === 'pdf';
}

export async function readDocumentAttachment(params: {
  file: File;
  buffer: ArrayBuffer;
}): Promise<ChatAttachment | null> {
  const { file, buffer } = params;
  const kind = isDocxFile(file) ? 'docx' : isPdfFile(file) ? 'pdf' : null;
  if (!kind) return null;

  const rawText = kind === 'docx' ? await readDocxText(buffer) : await readPdfText(buffer);
  const { text, truncated } = truncateDocumentText(rawText);
  if (!text) {
    return null;
  }

  return await createStoredAttachment({
    kind: 'file',
    name: file.name,
    mimeType: file.type || (kind === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf'),
    blob: file,
    textContent: summarizeDocumentText(kind, text, truncated)
  });
}
