import JSZip from 'jszip';
import { readPdfText } from './pdfTextReader';

export const MEMORY_REFERENCE_DOC_ACCEPT = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.log',
  '.xml',
  '.pdf',
  '.docx',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
].join(',');

export type MemoryReferenceDocImportDraft = {
  title: string;
  summary: string;
  content: string;
};

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'log',
  'xml'
]);

function extensionOf(fileName: string) {
  const lastSegment = fileName.split(/[\\/]/).pop() ?? fileName;
  const dotIndex = lastSegment.lastIndexOf('.');
  return dotIndex >= 0 ? lastSegment.slice(dotIndex + 1).toLowerCase() : '';
}

function titleFromFileName(fileName: string) {
  const baseName = (fileName.split(/[\\/]/).pop() ?? fileName).trim();
  const dotIndex = baseName.lastIndexOf('.');
  const title = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
  return title.trim() || '未命名资料';
}

function normalizeImportedText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function buildSummary(file: File, content: string) {
  const preview = content.replace(/\s+/g, ' ').trim();
  if (preview) return preview.slice(0, 96);
  return `上传文件：${file.name}`;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractDocxDocumentText(xml: string) {
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [xml];
  return paragraphs
    .map((paragraph) => {
      const textParts = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((match) => decodeXmlEntities(match[1] ?? ''));
      return textParts.join('');
    })
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

async function readDocxText(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')?.async('text');
  if (!documentXml) {
    throw new Error('没有找到 docx 正文。');
  }
  return extractDocxDocumentText(documentXml);
}

async function readFileText(file: File) {
  const extension = extensionOf(file.name);
  if (file.type === 'application/pdf' || extension === 'pdf') {
    return readPdfText(await file.arrayBuffer());
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || extension === 'docx'
  ) {
    return readDocxText(file);
  }
  if (file.type.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) {
    return file.text();
  }
  throw new Error(`不支持读取这种文档：${file.name}`);
}

export async function importMemoryReferenceDocFromFile(file: File): Promise<MemoryReferenceDocImportDraft> {
  const content = normalizeImportedText(await readFileText(file));
  if (!content) {
    throw new Error(`没有从 ${file.name} 里读到正文。`);
  }

  return {
    title: titleFromFileName(file.name),
    summary: buildSummary(file, content),
    content
  };
}
