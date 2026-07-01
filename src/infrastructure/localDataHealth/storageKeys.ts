/**
 * The raw storage key names the health/census diagnostic boundary reads. Health deliberately
 * re-derives these names (rather than importing store-side writers) because it inspects storage by
 * key shape across legacy and current layers. This is the shared key vocabulary; selection/
 * classification *policy* (which keys are diagnostic, lightweight, etc.) stays with the concern that
 * applies it.
 *
 * A key graduates into this module once a second concern references it. Concern-private keys may
 * stay with their concern until that concern is extracted.
 */

export const CHAT_COMMIT_POINTER_KEY = 'chat-commit-pointer-v1';
export const CHAT_MANIFEST_PREFIX = 'chat-manifest-v1:';
export const CHAT_COMMIT_MESSAGE_PREFIX = 'chat-message-v1:';
export const CHAT_CONVERSATION_ENVELOPE_PREFIX = 'chat-conversation-v1:';
export const CHAT_CATALOG_KEY = 'chat-catalog-v1';
export const CHAT_CONVERSATION_RECORD_PREFIX = 'chat-conversation-record-v1:';
export const CHAT_INDEX_KEY = 'chat-index-v2';
export const CHAT_INDEX_PENDING_KEY = 'chat-index-v2-pending';
export const CHAT_MESSAGE_PREFIX = 'chat-messages-v2:';
export const LEGACY_CHAT_STATE_KEY = 'chat-state-v1';

export const PERSONA_STATE_KEY = 'persona-state-v2';
export const PERSONA_MEMORY_DOC_CONTENT_KEY = 'persona-memory-doc-content-v1';
export const PERSONA_MEMORY_DOC_CONTENT_PREFIX = 'persona-memory-doc-content-v2:';
export const PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX = 'persona-memory-doc-content-v3:';

export const RUNTIME_STATE_KEY = 'runtime-providers-v2';

export const COLLECTION_STATE_KEY = 'collection-state-v2';
export const WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX = 'workspace-reference-doc-content-v1:';
export const WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX = 'workspace-reference-doc-content-v2:';

export const LOCAL_DATA_ROW_PREFIX = 'local-data-v1:row:';
