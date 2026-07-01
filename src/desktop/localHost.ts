export type DesktopLocalPermissionMode = 'confirm-each' | 'trusted';

export type DesktopTrustedRoot = {
  id: string;
  label: string;
  path: string;
  createdAt: number;
  lastUsedAt: number | null;
};

export type DesktopLocalHostState = {
  available: boolean;
  platform: string;
  permissionMode: DesktopLocalPermissionMode;
  trustedRoots: DesktopTrustedRoot[];
};

export type DesktopLocalDirectoryEntry = {
  name: string;
  kind: 'directory' | 'file' | 'other';
};

export type DesktopLocalDirectoryListing = {
  root: DesktopTrustedRoot;
  relativePath: string;
  entries: DesktopLocalDirectoryEntry[];
};

export type DesktopLocalWorkspaceFileSnapshot = {
  relativePath: string;
  content: string;
  bytes: number;
  updatedAt: number;
};

export type DesktopLocalWorkspaceReadResult = {
  root: DesktopTrustedRoot;
  files: DesktopLocalWorkspaceFileSnapshot[];
};

export type DesktopLocalWorkspaceWriteFile = {
  relativePath: string;
  content: string;
};

export type DesktopLocalWorkspaceWriteResult = {
  root: DesktopTrustedRoot;
  writtenFiles: Array<{
    relativePath: string;
    bytes: number;
  }>;
};

export type DesktopLocalReadResult = {
  root: DesktopTrustedRoot;
  relativePath: string;
  content: string;
};

export type DesktopLocalWriteResult = {
  root: DesktopTrustedRoot;
  relativePath: string;
  bytes: number;
};

export type DesktopLocalDirectoryCreateResult = {
  root: DesktopTrustedRoot;
  relativePath: string;
};

export type DesktopLocalPathDeleteResult = {
  root: DesktopTrustedRoot;
  relativePath: string;
  kind: 'directory' | 'file' | 'other';
};

export type DesktopLocalPathMoveResult = {
  root: DesktopTrustedRoot;
  fromRelativePath: string;
  toRelativePath: string;
  kind: 'directory' | 'file' | 'other';
};

export type DesktopLocalCommandResult = {
  root: DesktopTrustedRoot;
  cwd: string;
  cwdRelativePath: string;
  command: string;
  args: string[];
  durationMs: number;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
};

export type DesktopLocalCommandSequenceStep = {
  label?: string;
  command: string;
  args?: string[];
  cwdRelativePath?: string;
};

export type DesktopLocalCommandSequenceStepResult = DesktopLocalCommandResult & {
  index: number;
  label?: string;
};

export type DesktopLocalCommandSequenceResult = {
  root: DesktopTrustedRoot;
  durationMs: number;
  continueOnError: boolean;
  stoppedAtStep: number | null;
  steps: DesktopLocalCommandSequenceStepResult[];
};

export type DesktopLocalCommandSession = {
  id: string;
  root: DesktopTrustedRoot;
  cwd: string;
  cwdRelativePath: string;
  command: string;
  args: string[];
  status: 'running' | 'exited' | 'failed';
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
};

export type DesktopLocalCommandSessionEvent = {
  type: 'started' | 'output' | 'exit' | 'error';
  session: DesktopLocalCommandSession;
};

export type DesktopLocalListWorkspacesResult = {
  available: boolean;
  platform: string;
  permissionMode: DesktopLocalPermissionMode;
  trustedRoots: DesktopTrustedRoot[];
};

export type DesktopLocalHostBridge = {
  getState: () => Promise<DesktopLocalHostState>;
  setPermissionMode: (mode: DesktopLocalPermissionMode) => Promise<DesktopLocalHostState>;
  chooseRoot: () => Promise<DesktopLocalHostState>;
  removeRoot: (rootId: string) => Promise<DesktopLocalHostState>;
  listDirectory: (input: { rootId: string; relativePath?: string }) => Promise<DesktopLocalDirectoryListing>;
  readWorkspaceFiles: (input: { rootId: string }) => Promise<DesktopLocalWorkspaceReadResult>;
  writeWorkspaceFiles: (input: { rootId: string; files: DesktopLocalWorkspaceWriteFile[] }) => Promise<DesktopLocalWorkspaceWriteResult>;
  readFile: (input: { rootId: string; relativePath: string }) => Promise<DesktopLocalReadResult>;
  writeFile: (input: { rootId: string; relativePath: string; content: string }) => Promise<DesktopLocalWriteResult>;
  createDirectory?: (input: { rootId: string; relativePath: string }) => Promise<DesktopLocalDirectoryCreateResult>;
  deletePath?: (input: { rootId: string; relativePath: string }) => Promise<DesktopLocalPathDeleteResult>;
  movePath?: (input: { rootId: string; fromRelativePath: string; toRelativePath: string }) => Promise<DesktopLocalPathMoveResult>;
  runCommand: (input: { rootId: string; command: string; args?: string[]; cwdRelativePath?: string }) => Promise<DesktopLocalCommandResult>;
  runCommandSequence?: (input: { rootId: string; steps: DesktopLocalCommandSequenceStep[]; continueOnError?: boolean }) => Promise<DesktopLocalCommandSequenceResult>;
  startCommand?: (input: { rootId: string; command: string; args?: string[]; cwdRelativePath?: string }) => Promise<DesktopLocalCommandSession>;
  stopCommand?: (input: { sessionId: string }) => Promise<DesktopLocalCommandSession>;
  listCommandSessions?: () => Promise<DesktopLocalCommandSession[]>;
  onCommandSession?: (listener: (event: DesktopLocalCommandSessionEvent) => void) => () => void;
};

declare global {
  interface Window {
    polarisDesktopLocal?: DesktopLocalHostBridge;
  }
}

export function getDesktopLocalHostBridge() {
  if (typeof window === 'undefined') return null;
  return window.polarisDesktopLocal ?? null;
}

export function createUnavailableDesktopLocalState(): DesktopLocalHostState {
  return {
    available: false,
    platform: 'web',
    permissionMode: 'confirm-each',
    trustedRoots: []
  };
}
