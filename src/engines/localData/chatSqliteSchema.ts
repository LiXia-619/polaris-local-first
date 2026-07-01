const CHAT_CONVERSATION_TABLE = 'chat_conversation';
const CHAT_MESSAGE_TABLE = 'chat_message';

function normalizeSql(sql: string) {
  return sql.trim().replace(/\s+/g, ' ');
}

export const typedChatSqliteRawSql = {
  createConversationTable: `
CREATE TABLE IF NOT EXISTS ${CHAT_CONVERSATION_TABLE} (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  collaborator_id TEXT,
  group_room_id TEXT,
  active_project_id TEXT,
  pinned_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL
)`,

  createMessageTable: `
CREATE TABLE IF NOT EXISTS ${CHAT_MESSAGE_TABLE} (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY(conversation_id) REFERENCES ${CHAT_CONVERSATION_TABLE}(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, seq)
)`,

  createConversationUpdatedIndex: `
CREATE INDEX IF NOT EXISTS idx_chat_conversation_updated_at
ON ${CHAT_CONVERSATION_TABLE}(updated_at DESC, id ASC)`,

  createMessageConversationSeqIndex: `
CREATE INDEX IF NOT EXISTS idx_chat_message_conversation_seq
ON ${CHAT_MESSAGE_TABLE}(conversation_id, seq)`,

  upsertConversation: `
INSERT INTO ${CHAT_CONVERSATION_TABLE} (
  id,
  title,
  kind,
  collaborator_id,
  group_room_id,
  active_project_id,
  pinned_at,
  created_at,
  updated_at,
  metadata_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  kind = excluded.kind,
  collaborator_id = excluded.collaborator_id,
  group_room_id = excluded.group_room_id,
  active_project_id = excluded.active_project_id,
  pinned_at = excluded.pinned_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  metadata_json = excluded.metadata_json`,

  deleteConversationMessages: `
DELETE FROM ${CHAT_MESSAGE_TABLE}
WHERE conversation_id = ?`,

  upsertMessage: `
INSERT INTO ${CHAT_MESSAGE_TABLE} (
  id,
  conversation_id,
  seq,
  role,
  content,
  reasoning,
  created_at,
  updated_at,
  payload_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  conversation_id = excluded.conversation_id,
  seq = excluded.seq,
  role = excluded.role,
  content = excluded.content,
  reasoning = excluded.reasoning,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  payload_json = excluded.payload_json`,

  readConversationSummaries: `
SELECT
  c.id,
  c.title,
  c.kind,
  c.collaborator_id,
  c.group_room_id,
  c.active_project_id,
  c.pinned_at,
  c.created_at,
  c.updated_at,
  COUNT(m.id) AS message_count,
  COALESCE(MAX(m.updated_at), 0) AS latest_message_timestamp
FROM ${CHAT_CONVERSATION_TABLE} c
LEFT JOIN ${CHAT_MESSAGE_TABLE} m ON m.conversation_id = c.id
GROUP BY
  c.id,
  c.title,
  c.kind,
  c.collaborator_id,
  c.group_room_id,
  c.active_project_id,
  c.pinned_at,
  c.created_at,
  c.updated_at
ORDER BY c.updated_at DESC, c.id ASC`,

  readConversationExists: `
SELECT id
FROM ${CHAT_CONVERSATION_TABLE}
WHERE id = ?
LIMIT 1`,

  readConversationMetadata: `
SELECT metadata_json
FROM ${CHAT_CONVERSATION_TABLE}
WHERE id = ?
LIMIT 1`,

  readMessageCount: `
SELECT COUNT(*) AS message_count
FROM ${CHAT_MESSAGE_TABLE}
WHERE conversation_id = ?`,

  readRecentMessages: `
SELECT seq, payload_json
FROM ${CHAT_MESSAGE_TABLE}
WHERE conversation_id = ?
ORDER BY seq DESC
LIMIT ?`,

  readMessagesBeforeSeq: `
SELECT seq, payload_json
FROM ${CHAT_MESSAGE_TABLE}
WHERE conversation_id = ? AND seq < ?
ORDER BY seq DESC
LIMIT ?`
} as const;

export const typedChatSqliteSql = {
  createConversationTable: normalizeSql(typedChatSqliteRawSql.createConversationTable),
  createMessageTable: normalizeSql(typedChatSqliteRawSql.createMessageTable),
  createConversationUpdatedIndex: normalizeSql(typedChatSqliteRawSql.createConversationUpdatedIndex),
  createMessageConversationSeqIndex: normalizeSql(typedChatSqliteRawSql.createMessageConversationSeqIndex),
  upsertConversation: normalizeSql(typedChatSqliteRawSql.upsertConversation),
  deleteConversationMessages: normalizeSql(typedChatSqliteRawSql.deleteConversationMessages),
  upsertMessage: normalizeSql(typedChatSqliteRawSql.upsertMessage),
  readConversationSummaries: normalizeSql(typedChatSqliteRawSql.readConversationSummaries),
  readConversationExists: normalizeSql(typedChatSqliteRawSql.readConversationExists),
  readConversationMetadata: normalizeSql(typedChatSqliteRawSql.readConversationMetadata),
  readMessageCount: normalizeSql(typedChatSqliteRawSql.readMessageCount),
  readRecentMessages: normalizeSql(typedChatSqliteRawSql.readRecentMessages),
  readMessagesBeforeSeq: normalizeSql(typedChatSqliteRawSql.readMessagesBeforeSeq)
} as const;
