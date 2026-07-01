import { createStoredAttachment } from '../infrastructure/assetStore';
import type { ChatAttachment } from '../types/domain';

const MAX_SPREADSHEET_CHARS = 80_000;
const MAX_SHEET_COUNT = 4;
const MAX_ROW_COUNT = 80;
const MAX_COLUMN_COUNT = 12;

const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel'
]);
const XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

function getExtension(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function truncateSpreadsheetText(text: string) {
  const normalized = text.replace(/\r/g, '').replace(/\u0000/g, '').trim();
  if (!normalized) {
    return { text: '', truncated: false };
  }

  if (normalized.length <= MAX_SPREADSHEET_CHARS) {
    return { text: normalized, truncated: false };
  }

  return {
    text: normalized.slice(0, MAX_SPREADSHEET_CHARS).trim(),
    truncated: true
  };
}

function normalizeCell(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function summarizeGrid(label: string, rows: string[][], truncated: boolean) {
  if (!rows.length) {
    return '';
  }

  const limitedRows = rows.slice(0, MAX_ROW_COUNT).map((row) =>
    row.slice(0, MAX_COLUMN_COUNT).map((cell) => normalizeCell(cell))
  );
  const visibleColumnCount = Math.max(...limitedRows.map((row) => row.length), 0);
  const clippedRows = limitedRows.map((row) =>
    Array.from({ length: visibleColumnCount }, (_, index) => row[index] ?? '')
  );
  const lines = clippedRows.map((row) => row.join(' | ').trimEnd());
  const rowTruncated = rows.length > MAX_ROW_COUNT;
  const columnTruncated = rows.some((row) => row.length > MAX_COLUMN_COUNT);

  return [
    `### ${label}`,
    ...lines,
    rowTruncated ? '[行数已截断]' : '',
    columnTruncated ? '[列数已截断]' : '',
    truncated ? '[内容已按体积截断]' : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      const next = text[index + 1];
      if (inQuotes && next === '"') {
        current += '""';
        index += 1;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      if (current.trim()) {
        rows.push(parseCsvLine(current));
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    rows.push(parseCsvLine(current));
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function nodeLocalName(node: Element) {
  return node.localName || node.tagName.split(':').pop() || '';
}

function resolveWorkbookPath(target: string) {
  const trimmed = target.replace(/^\//, '');
  return trimmed.startsWith('xl/') ? trimmed : `xl/${trimmed.replace(/^\.\//, '')}`;
}

function columnLettersToIndex(ref: string) {
  const letters = ref.replace(/\d+/g, '').toUpperCase();
  let value = 0;
  for (let index = 0; index < letters.length; index += 1) {
    value = value * 26 + (letters.charCodeAt(index) - 64);
  }
  return Math.max(0, value - 1);
}

function parseSharedStrings(xmlText: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  return Array.from(doc.getElementsByTagName('*'))
    .filter((element) => nodeLocalName(element) === 'si')
    .map((item) =>
      Array.from(item.getElementsByTagName('*'))
        .filter((element) => nodeLocalName(element) === 't')
        .map((element) => element.textContent ?? '')
        .join('')
    );
}

function parseWorkbookSheets(workbookXml: string, relsXml: string | null) {
  const parser = new DOMParser();
  const workbookDoc = parser.parseFromString(workbookXml, 'application/xml');
  const relMap = new Map<string, string>();

  if (relsXml) {
    const relDoc = parser.parseFromString(relsXml, 'application/xml');
    Array.from(relDoc.getElementsByTagName('*'))
      .filter((element) => nodeLocalName(element) === 'Relationship')
      .forEach((element) => {
        const id = element.getAttribute('Id');
        const target = element.getAttribute('Target');
        if (id && target) {
          relMap.set(id, resolveWorkbookPath(target));
        }
      });
  }

  return Array.from(workbookDoc.getElementsByTagName('*'))
    .filter((element) => nodeLocalName(element) === 'sheet')
    .map((element, index) => ({
      name: element.getAttribute('name') || `Sheet${index + 1}`,
      path: relMap.get(
        element.getAttribute('r:id') || element.getAttribute('id') || ''
      ) || `xl/worksheets/sheet${index + 1}.xml`
    }));
}

function parseCellValue(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') {
    return Array.from(cell.getElementsByTagName('*'))
      .filter((element) => nodeLocalName(element) === 't')
      .map((element) => element.textContent ?? '')
      .join('');
  }

  const valueElement = Array.from(cell.getElementsByTagName('*')).find((element) => nodeLocalName(element) === 'v');
  const rawValue = valueElement?.textContent ?? '';
  if (type === 's') {
    const sharedIndex = Number.parseInt(rawValue, 10);
    return Number.isFinite(sharedIndex) ? sharedStrings[sharedIndex] ?? '' : '';
  }

  return rawValue;
}

function parseWorksheetRows(xmlText: string, sharedStrings: string[]) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const rows = Array.from(doc.getElementsByTagName('*')).filter((element) => nodeLocalName(element) === 'row');

  return rows.map((row) => {
    const cells = Array.from(row.getElementsByTagName('*')).filter((element) => nodeLocalName(element) === 'c');
    const result: string[] = [];
    for (const cell of cells) {
      const ref = cell.getAttribute('r') || '';
      const columnIndex = ref ? columnLettersToIndex(ref) : result.length;
      const value = normalizeCell(parseCellValue(cell, sharedStrings));
      if (!value) continue;
      while (result.length < columnIndex) {
        result.push('');
      }
      result[columnIndex] = value;
    }
    return result;
  }).filter((row) => row.some(Boolean));
}

async function readXlsxText(buffer: ArrayBuffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const workbookEntry = zip.file('xl/workbook.xml');
  if (!workbookEntry) return '';

  const [workbookXml, relsXml, sharedStringsXml] = await Promise.all([
    workbookEntry.async('string'),
    zip.file('xl/_rels/workbook.xml.rels')?.async('string') ?? Promise.resolve(null),
    zip.file('xl/sharedStrings.xml')?.async('string') ?? Promise.resolve(null)
  ]);
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const sheets = parseWorkbookSheets(workbookXml, relsXml).slice(0, MAX_SHEET_COUNT);
  const sections: string[] = [];

  for (const sheet of sheets) {
    const entry = zip.file(sheet.path);
    if (!entry) continue;
    const xmlText = await entry.async('string');
    const rows = parseWorksheetRows(xmlText, sharedStrings);
    const section = summarizeGrid(sheet.name, rows, false);
    if (section) {
      sections.push(section);
    }
  }

  return sections.join('\n\n').trim();
}

export function isCsvFile(file: File) {
  return CSV_MIME_TYPES.has(file.type) || getExtension(file.name) === 'csv';
}

export function isXlsxFile(file: File) {
  return XLSX_MIME_TYPES.has(file.type) || getExtension(file.name) === 'xlsx';
}

export async function readSpreadsheetAttachment(params: {
  file: File;
  buffer: ArrayBuffer;
}): Promise<ChatAttachment | null> {
  const { file, buffer } = params;
  const kind = isCsvFile(file) ? 'csv' : isXlsxFile(file) ? 'xlsx' : null;
  if (!kind) return null;

  const rawText =
    kind === 'csv'
      ? summarizeGrid(file.name, parseCsvRows(new TextDecoder().decode(buffer)), false)
      : await readXlsxText(buffer);
  const { text, truncated } = truncateSpreadsheetText(rawText);
  if (!text) return null;

  return await createStoredAttachment({
    kind: 'file',
    name: file.name,
    mimeType: file.type || (kind === 'csv'
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    blob: file,
    textContent: [
      kind === 'csv' ? '已从 CSV 中整理出表格内容。' : '已从 XLSX 中提取表格内容。',
      truncated ? '内容已按体积截断。' : '',
      '',
      text
    ].filter(Boolean).join('\n')
  });
}
