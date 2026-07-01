import type { ToolInvocationKind } from '../toolInvocationKinds.js';
import type { ChatNativeToolCall, CodeCardFileRole, ThemeSurfaceId, ThemeToolPatchMode, ThemeToolScope, ToolInvocationStatus, World } from './primitives';
import type { ThemeFrame, ThemeRecipeMeta } from './theme';

export type WebSearchResultFact = {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishedAt?: string;
};

export type WebSearchEvidence = {
  query: string;
  provider: string;
  degraded?: boolean;
  warning?: string;
  results: WebSearchResultFact[];
};

export type WebPageReadEvidence = {
  url: string;
  title: string | null;
  provider: string;
  excerpt: string;
  truncated?: boolean;
  originalLength?: number;
};

export type ToolInvocation = {
  id: string;
  kind: ToolInvocationKind;
  toolName?: string;
  status: ToolInvocationStatus;
  title: string;
  summary: string;
  previewId?: string;
  themeScope?: ThemeToolScope;
  themeSurfaceIds?: ThemeSurfaceId[];
  themeSurfaceLabels?: string[];
  themePatchMode?: ThemeToolPatchMode;
  themeTransactionReason?: string;
  themeIntentLabel?: string;
  themeRecipe?: ThemeRecipeMeta;
  themeBatchCount?: number;
  themeBatchLabels?: string[];
  historyLabel?: string;
  foldedIntoPreviewId?: string;
  beforeTheme?: ThemeFrame;
  nextTheme?: ThemeFrame;
  presetId?: string;
  world?: World;
  cardId?: string;
  projectFileId?: string;
  projectFileIds?: string[];
  projectFilePaths?: string[];
  projectFiles?: ProjectFileFact[];
  projectFileReads?: ProjectFileReadEvidence[];
  projectFileEffects?: ProjectFileEffect[];
  workspaceReferenceDocId?: string;
  workspaceReferenceDocTitle?: string;
  workspaceReferenceDocs?: WorkspaceReferenceDocFact[];
  workspaceReferenceDocReads?: WorkspaceReferenceDocReadEvidence[];
  readableContextCandidates?: ReadableContextCandidate[];
  codeWriteDetails?: ToolCodeWriteDetail[];
  projectDiagnostics?: ProjectDiagnosticEvidence[];
  projectPreviewRunnable?: boolean;
  imageCardId?: string;
  originMessageId?: string;
  memoryItems?: string[];
  memoryDocId?: string;
  memoryDocTitle?: string;
  memoryDocSummary?: string;
  memoryDocContent?: string;
  codeSaveCount?: number;
  codeSaveTotal?: number;
  webSearch?: WebSearchEvidence;
  webPageRead?: WebPageReadEvidence;
  targetLabel?: string;
  toolCallId?: string;
  mcpResult?: McpToolResultEvidence;
  detailText?: string;
  error?: string;
};

export type McpToolResultEvidence = {
  serverId: string;
  serverName: string;
  schemaName?: string;
  toolName: string;
  argumentsObject: Record<string, unknown>;
  isError?: boolean;
  structuredContent?: unknown;
};

export type ProjectFileFact = {
  projectId: string;
  fileId: string;
  filePath: string;
  language: string;
  fileRole?: CodeCardFileRole;
  isEntry?: boolean;
  totalLines: number;
  totalChars: number;
};

export type ProjectFileReadEvidence =
  | {
      kind: 'directory';
      projectId: string;
      totalFiles: number;
      files: ProjectFileFact[];
    }
  | {
      kind: 'file';
      projectId: string;
      file: ProjectFileFact;
    }
  | {
      kind: 'context';
      projectId: string;
      fileId: string;
      filePath: string;
      language: string;
      startLine: number;
      endLine: number;
      totalLines: number;
      anchorLineNumber: number | null;
      totalMatches?: number;
    }
  | {
      kind: 'search';
      projectId: string;
      query: string;
      totalMatches: number;
      returnedMatches: number;
      matches: Array<{
        fileId: string;
        filePath: string;
        language: string;
        matchKind?: 'content' | 'path';
        matchReason?: string;
        lineNumber: number;
        line: string;
        excerptStartLine?: number;
        excerptEndLine?: number;
        excerpt?: string;
      }>;
    };

export type ProjectFileEffect = {
  projectId: string;
  fileId: string;
  filePath: string;
  operation: 'created' | 'overwritten' | 'appended' | 'inserted' | 'replaced' | 'deleted';
  beforeLines?: number;
  afterLines?: number;
  changedLines?: {
    start: number;
    end: number;
  };
  afterExcerptStartLine?: number;
  afterExcerptEndLine?: number;
  afterExcerpt?: string;
  insertedChars?: number;
  removedChars?: number;
  matchCount?: number;
};

export type WorkspaceReferenceDocFact = {
  projectId: string;
  docId: string;
  title: string;
  summary: string;
  totalChars: number;
  updatedAt: number;
};

export type WorkspaceReferenceDocReadEvidence =
  | {
      kind: 'directory';
      projectId: string;
      totalDocs: number;
      docs: WorkspaceReferenceDocFact[];
    }
  | {
      kind: 'doc';
      projectId: string;
      doc: WorkspaceReferenceDocFact;
    }
  | {
      kind: 'search';
      projectId: string;
      query: string;
      totalMatches: number;
      returnedMatches: number;
      matches: Array<{
        docId: string;
        title: string;
        matchKind: 'title' | 'summary' | 'content';
        excerpt: string;
      }>;
    };

export type ReadableContextCandidate = {
  source: 'project-file' | 'workspace-reference' | 'memory-doc';
  title: string;
  id: string;
  projectId?: string;
  path?: string;
  summary?: string;
  matchKind?: string;
  readTool: 'readProjectFile' | 'readWorkspaceReference' | 'readMemoryDoc';
  readArgs: Record<string, string>;
  excerpt?: string;
};

export type ToolCodeWriteDetail = {
  label: string;
  language?: string;
  code: string;
  addedLines: number;
  removedLines: number;
};

export type ProjectDiagnosticEvidence = {
  tool: 'checkProjectPreview' | 'inspectProjectRuntime';
  projectId: string;
  runnable: boolean;
  reason?: 'ok' | 'missing-entry' | 'syntax-error' | 'not-runnable' | 'unavailable' | 'timeout' | 'console-error' | 'resource-error' | 'blank-page';
  entryFileId?: string;
  entryFilePath?: string;
  fileCount?: number;
  inlinedLocalAssets?: string[];
  missingLocalAssets?: string[];
  externalAssets?: string[];
  diagnostics?: Array<{
    severity: 'info' | 'warning' | 'error';
    filePath: string;
    lineNumber?: number;
    columnNumber?: number;
    message: string;
    excerpt?: string;
  }>;
  status?: 'loaded' | 'not-runnable' | 'unavailable' | 'timeout';
  logs?: Array<{
    level: 'log' | 'warn' | 'error' | 'info';
    message: string;
    kind?: 'console' | 'runtime-error' | 'unhandled-rejection' | 'resource-error';
    filePath?: string;
    filename?: string;
    lineNumber?: number;
    columnNumber?: number;
    stack?: string;
    resourceUrl?: string;
    tagName?: string;
  }>;
  firstErrorMessage?: string;
  firstErrorFilePath?: string;
  firstErrorLineNumber?: number;
  firstErrorColumnNumber?: number;
  errorsCount?: number;
  warningsCount?: number;
  bodyEmpty?: boolean;
  bodyTextLength?: number;
  visibleElementCount?: number;
  interactiveElementCount?: number;
  resourceErrorCount?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  documentWidth?: number;
  documentHeight?: number;
};

export type ToolLedgerEntry = {
  id: string;
  toolCallId: string;
  assistantMessageId: string;
  order: number;
  toolName: string;
  argumentsText: string;
  providerMetadata?: ChatNativeToolCall['providerMetadata'];
  sourceSpan?: ChatNativeToolCall['sourceSpan'];
  resultMessageId?: string;
  resultToolName?: string;
  resultStatus?: ToolInvocationStatus;
  resultIsError?: boolean;
  resultSourceMessageId?: string;
  resultStructuredPayload?: Record<string, unknown>;
};

