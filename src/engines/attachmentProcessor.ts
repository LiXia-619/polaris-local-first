import { createStoredAttachment } from '../infrastructure/assetStore';
import { isDocxFile, isPdfFile, readDocumentAttachment } from './attachmentDocumentReaders';
import { prepareStoredImageBlob } from './imageAssetProcessing';
import { isCsvFile, isXlsxFile, readSpreadsheetAttachment } from './attachmentSpreadsheetReaders';
import type { ChatAttachment } from '../types/domain';

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_SPREADSHEET_BYTES = 8 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'js',
  'jsx',
  'ts',
  'tsx',
  'css',
  'html',
  'xml',
  'yml',
  'yaml',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'sh',
  'sql'
]);
const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip'
]);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error(`读取 ${file.name} 失败`));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error(`读取 ${file.name} 失败`));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error(`读取 ${file.name} 失败`));
    };
    reader.onerror = () => reject(reader.error ?? new Error(`读取 ${file.name} 失败`));
    reader.readAsArrayBuffer(file);
  });
}

function getExtension(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function isTextLikeFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true;
  if (file.type === 'application/json' || file.type === 'application/xml') return true;
  return TEXT_EXTENSIONS.has(getExtension(file.name));
}

function isTextLikeEntry(name: string): boolean {
  return TEXT_EXTENSIONS.has(getExtension(name));
}

function isZipFile(file: File): boolean {
  return ZIP_MIME_TYPES.has(file.type) || getExtension(file.name) === 'zip';
}

async function readStructuredDocumentAsAttachment(file: File): Promise<ChatAttachment | null> {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(`${file.name} 超过 8MB，先拆小一点再发更稳。`);
  }

  const buffer = await readFileAsArrayBuffer(file);
  return await readDocumentAttachment({ file, buffer });
}

async function createRawFileAttachment(file: File, mimeType: string): Promise<ChatAttachment> {
  return await createStoredAttachment({
    kind: 'file',
    name: file.name,
    mimeType: file.type || mimeType,
    blob: file
  });
}

async function readSpreadsheetAsAttachment(file: File): Promise<ChatAttachment | null> {
  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new Error(`${file.name} 超过 8MB，先拆小一点再发更稳。`);
  }

  const buffer = await readFileAsArrayBuffer(file);
  return await readSpreadsheetAttachment({ file, buffer });
}

function formatAttachmentStorageError(file: File, error: unknown) {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) {
    return `${file.name} 保存失败了，像是本地存储这一步没接住。`;
  }
  return `${file.name} 保存失败：${message}`;
}

export async function readFilesAsAttachments(files: FileList | File[]): Promise<{
  attachments: ChatAttachment[];
  rejected: string[];
  warnings: string[];
}> {
  const attachments: ChatAttachment[] = [];
  const rejected: string[] = [];
  const warnings: string[] = [];

  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) {
      try {
        const processedImage = await prepareStoredImageBlob({
          blob: file,
          mimeType: file.type || 'image/*'
        });
        attachments.push(
          await createStoredAttachment({
            kind: 'image',
            name: file.name,
            mimeType: processedImage.mimeType,
            blob: processedImage.blob,
            previewBlob: processedImage.previewBlob
          })
        );
      } catch (error) {
        rejected.push(formatAttachmentStorageError(file, error));
      }
      continue;
    }

    if (isPdfFile(file) || isDocxFile(file)) {
      try {
        const attachment = await readStructuredDocumentAsAttachment(file);
        if (!attachment) {
          if (isPdfFile(file)) {
            attachments.push(await createRawFileAttachment(file, 'application/pdf'));
            warnings.push(`${file.name} 已附上原始 PDF，但没有提取到可读文字；如果是扫描件，可以先 OCR 或复制正文再发。`);
            continue;
          }
          rejected.push(`${file.name} 里没有提取到可读文字，可能是扫描件或受保护文档。`);
          continue;
        }
        attachments.push(attachment);
      } catch (error) {
        if (isPdfFile(file)) {
          try {
            attachments.push(await createRawFileAttachment(file, 'application/pdf'));
            warnings.push(`${file.name} 已附上原始 PDF，但本机 PDF 解析器没有提取成功；模型这轮只能看到文件名。`);
          } catch (storageError) {
            rejected.push(formatAttachmentStorageError(file, storageError));
          }
          continue;
        }
        rejected.push(error instanceof Error ? error.message : `${file.name} 读取失败。`);
      }
      continue;
    }

    if (isCsvFile(file) || isXlsxFile(file)) {
      try {
        const attachment = await readSpreadsheetAsAttachment(file);
        if (!attachment) {
          rejected.push(`${file.name} 里没有提取到可读表格内容。`);
          continue;
        }
        attachments.push(attachment);
      } catch (error) {
        rejected.push(error instanceof Error ? error.message : `${file.name} 读取失败。`);
      }
      continue;
    }

    if (isZipFile(file)) {
      try {
        attachments.push(
          await createStoredAttachment({
            kind: 'file',
            name: file.name,
            mimeType: file.type || 'application/zip',
            blob: file
          })
        );
      } catch (error) {
        rejected.push(formatAttachmentStorageError(file, error));
      }
      continue;
    }

    if (isTextLikeFile(file)) {
      const textContent = await readFileAsText(file);
      try {
        attachments.push(
          await createStoredAttachment({
            kind: 'file',
            name: file.name,
            mimeType: file.type || 'text/plain',
            blob: file,
            textContent
          })
        );
      } catch (error) {
        rejected.push(formatAttachmentStorageError(file, error));
      }
      continue;
    }

    rejected.push(`${file.name} 不支持这种文件。可以发送图片、zip、pdf、docx、xlsx、csv、和文本/代码文件。`);
  }

  return { attachments, rejected, warnings };
}
