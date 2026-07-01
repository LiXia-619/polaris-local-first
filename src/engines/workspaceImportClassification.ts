export type WorkspaceImportDestination = 'project-file' | 'reference-doc' | 'unsupported';

type WorkspaceImportFileLike = {
  name: string;
  type?: string;
};

const PROJECT_FILE_EXTENSIONS = new Set([
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'json',
  'yml',
  'yaml',
  'toml',
  'svg',
  'sql',
  'py',
  'rb',
  'rs',
  'go',
  'java',
  'kt',
  'swift',
  'sh',
  'zsh',
  'bash'
]);

const PROJECT_FILE_NAMES = new Set([
  'dockerfile',
  'makefile',
  'package-lock.json',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'vite.config.js',
  'vite.config.ts'
]);

const REFERENCE_DOC_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'log',
  'xml',
  'pdf',
  'docx'
]);

function basenameOf(fileName: string) {
  return (fileName.split(/[\\/]/).pop() ?? fileName).trim();
}

function extensionOf(fileName: string) {
  const basename = basenameOf(fileName);
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex > 0 ? basename.slice(dotIndex + 1).toLowerCase() : '';
}

export function classifyWorkspaceImportFile(file: WorkspaceImportFileLike): WorkspaceImportDestination {
  const basename = basenameOf(file.name).toLowerCase();
  const extension = extensionOf(file.name);
  const mimeType = (file.type ?? '').trim().toLowerCase();

  if (PROJECT_FILE_NAMES.has(basename) || PROJECT_FILE_EXTENSIONS.has(extension)) {
    return 'project-file';
  }

  if (
    REFERENCE_DOC_EXTENSIONS.has(extension)
    || mimeType === 'application/pdf'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || mimeType.startsWith('text/')
  ) {
    return 'reference-doc';
  }

  return 'unsupported';
}
