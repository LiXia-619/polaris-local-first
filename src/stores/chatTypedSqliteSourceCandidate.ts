import type { TypedChatSqliteStore } from '../engines/localData';
import { LOCAL_DATA_SCHEMA_VERSION } from '../engines/localData/types';
import {
  createNativeTypedChatSqliteStore,
  getNativeLocalDataSqlitePlatform,
  type NativeLocalDataSqlitePlatform
} from '../native/localDataSqlite';
import {
  readChatStateFromTypedChatSqliteStore,
  type ChatTypedSqlitePersistenceReadArgs
} from './chatTypedSqlitePersistence';
import type { PersistedChatState } from './chatCurrentPersistence';

type TypedChatSqliteReadableStore = Pick<
  TypedChatSqliteStore,
  'readConversationSummaries' | 'readConversationMetadata' | 'readMessageWindow'
>;

export type ChatTypedSqliteSourceCandidateReady = {
  status: 'ready';
  platform: NativeLocalDataSqlitePlatform;
  state: PersistedChatState;
  activeConversationCount: number;
  loadedConversationCount: number;
};

export type ChatTypedSqliteSourceCandidateUnavailable = {
  status: 'unavailable';
  platform: null;
  reason: 'native-sqlite-unavailable';
};

export type ChatTypedSqliteSourceCandidateEmpty = {
  status: 'empty';
  platform: NativeLocalDataSqlitePlatform;
  reason: 'typed-sqlite-empty';
};

export type ChatTypedSqliteSourceCandidateQuarantined = {
  status: 'quarantined';
  platform: NativeLocalDataSqlitePlatform;
  reason: 'typed-sqlite-quarantined';
  state: PersistedChatState;
  quarantinedConversationIds: string[];
};

export type ChatTypedSqliteSourceCandidateFailed = {
  status: 'failed';
  platform: NativeLocalDataSqlitePlatform;
  reason: 'typed-sqlite-read-failed';
  errorMessage: string;
};

export type ChatTypedSqliteSourceCandidate =
  | ChatTypedSqliteSourceCandidateReady
  | ChatTypedSqliteSourceCandidateUnavailable
  | ChatTypedSqliteSourceCandidateEmpty
  | ChatTypedSqliteSourceCandidateQuarantined
  | ChatTypedSqliteSourceCandidateFailed;

export type ChatTypedSqliteSourceCandidateArgs = {
  activeConversationId?: string | null;
  version?: number;
  committedAt?: number;
  readAt?: number;
  messageWindowLimit?: number;
  getPlatform?: () => NativeLocalDataSqlitePlatform | null;
  createStore?: () => TypedChatSqliteReadableStore;
  readState?: (args: ChatTypedSqlitePersistenceReadArgs) => Promise<PersistedChatState | null>;
};

export async function evaluateNativeTypedChatSqliteSourceCandidate(
  args: ChatTypedSqliteSourceCandidateArgs = {}
): Promise<ChatTypedSqliteSourceCandidate> {
  const platform = args.getPlatform ? args.getPlatform() : getNativeLocalDataSqlitePlatform();
  if (!platform) {
    return {
      status: 'unavailable',
      platform: null,
      reason: 'native-sqlite-unavailable'
    };
  }

  const readState = args.readState ?? readChatStateFromTypedChatSqliteStore;
  const now = Date.now();

  try {
    const state = await readState({
      store: args.createStore ? args.createStore() : createNativeTypedChatSqliteStore(),
      activeConversationId: args.activeConversationId ?? null,
      version: args.version ?? LOCAL_DATA_SCHEMA_VERSION,
      committedAt: args.committedAt ?? now,
      readAt: args.readAt ?? now,
      messageWindowLimit: args.messageWindowLimit ?? Number.MAX_SAFE_INTEGER
    });

    if (!state) {
      return {
        status: 'empty',
        platform,
        reason: 'typed-sqlite-empty'
      };
    }

    const quarantinedConversationIds = state.quarantinedConversationIds ?? [];
    if (quarantinedConversationIds.length > 0) {
      return {
        status: 'quarantined',
        platform,
        reason: 'typed-sqlite-quarantined',
        state,
        quarantinedConversationIds
      };
    }

    return {
      status: 'ready',
      platform,
      state,
      activeConversationCount: state.conversations.length,
      loadedConversationCount: state.loadedConversationIds?.length ?? 0
    };
  } catch (error) {
    return {
      status: 'failed',
      platform,
      reason: 'typed-sqlite-read-failed',
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}
