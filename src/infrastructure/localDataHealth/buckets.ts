import {
  CHAT_COMMIT_POINTER_KEY,
  CHAT_MANIFEST_PREFIX,
  CHAT_COMMIT_MESSAGE_PREFIX,
  CHAT_CONVERSATION_ENVELOPE_PREFIX,
  CHAT_CATALOG_KEY,
  CHAT_CONVERSATION_RECORD_PREFIX,
  CHAT_INDEX_KEY,
  CHAT_INDEX_PENDING_KEY,
  CHAT_MESSAGE_PREFIX,
  LEGACY_CHAT_STATE_KEY,
  PERSONA_MEMORY_DOC_CONTENT_KEY,
  PERSONA_MEMORY_DOC_CONTENT_PREFIX,
  PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX,
  WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX,
  WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX
} from './storageKeys';

export type LocalDataHealthBucketId =
  | 'chat'
  | 'collection'
  | 'persona'
  | 'runtime'
  | 'space'
  | 'assets'
  | 'diagnostics'
  | 'other';

export type LocalDataHealthBucket = {
  id: LocalDataHealthBucketId;
  label: string;
  bytes: number;
  entryCount: number;
};

export const BUCKET_LABELS: Record<LocalDataHealthBucketId, string> = {
  chat: '对话',
  collection: '房间与工作区',
  persona: '协作者',
  runtime: '服务与工具配置',
  space: '界面与主题',
  assets: '附件与图片',
  diagnostics: '诊断日志',
  other: '其他本地状态'
};

export const BUCKET_ORDER: LocalDataHealthBucketId[] = [
  'chat',
  'collection',
  'assets',
  'persona',
  'runtime',
  'space',
  'diagnostics',
  'other'
];

const DIAGNOSTIC_LOCAL_STORAGE_KEYS = new Set([
  'polaris-client-error-log',
  'polaris-request-debug-log',
  'polaris-stream-debug-log',
  'polaris-chat-qa-audit-log',
  'polaris-model-flow-trace-log',
  'polaris-environment-contract-qa-reports',
  'polaris-runtime-performance-log',
  'polaris-app-runtime-log'
]);

export function textBytes(value: string) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
}

export function estimateLocalDataBytes(value: unknown): number {
  if (value instanceof Blob) return value.size;
  if (typeof value === 'string') return textBytes(value);
  try {
    return textBytes(JSON.stringify(value));
  } catch {
    return textBytes(String(value));
  }
}

export function classifyKvKey(key: string): LocalDataHealthBucketId {
  if (
    key === CHAT_CATALOG_KEY
    || key.startsWith(CHAT_CONVERSATION_RECORD_PREFIX)
    || key === CHAT_COMMIT_POINTER_KEY
    || key.startsWith(CHAT_MANIFEST_PREFIX)
    || key.startsWith(CHAT_COMMIT_MESSAGE_PREFIX)
    || key.startsWith(CHAT_CONVERSATION_ENVELOPE_PREFIX)
    || key === CHAT_INDEX_KEY
    || key === CHAT_INDEX_PENDING_KEY
    || key.startsWith(CHAT_MESSAGE_PREFIX)
    || key === LEGACY_CHAT_STATE_KEY
  ) {
    return 'chat';
  }
  if (
    key.startsWith('collection-state-')
    || key.startsWith(WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX)
    || key.startsWith(WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX)
  ) return 'collection';
  if (
    key.startsWith('persona-state-')
    || key === PERSONA_MEMORY_DOC_CONTENT_KEY
    || key.startsWith(PERSONA_MEMORY_DOC_CONTENT_PREFIX)
    || key.startsWith(PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX)
    || key.startsWith('memory-vector-index-entry-v1:')
    || key.startsWith('memory-vector-index-meta-v1:')
  ) return 'persona';
  if (key.startsWith('runtime-')) return 'runtime';
  if (key === 'space-theme-state-v1') return 'space';
  return 'other';
}

export function classifyLocalStorageKey(key: string): LocalDataHealthBucketId {
  if (DIAGNOSTIC_LOCAL_STORAGE_KEYS.has(key)) return 'diagnostics';
  if (key === 'polaris-space-store-v1') return 'space';
  if (key === 'polaris-developer-mode' || key === 'polaris-run-code-sandbox-mode') return 'runtime';
  if (key === 'polaris-chat-index-v2-mirror' || key.startsWith('polaris-chat-messages-v2-mirror:')) return 'chat';
  return 'other';
}
