import { useEffect } from 'react';
import type { Conversation } from '../../types/domain';

type UseCollectionOwnershipBackfillArgs = {
  startupReady: boolean;
  collectionHydrated: boolean;
  conversations: Conversation[];
  backfillOwnershipFromConversations: (conversations: Conversation[]) => void;
};

export function useCollectionOwnershipBackfill({
  startupReady,
  collectionHydrated,
  conversations,
  backfillOwnershipFromConversations
}: UseCollectionOwnershipBackfillArgs) {
  useEffect(() => {
    if (!startupReady || !collectionHydrated || conversations.length === 0) return;
    backfillOwnershipFromConversations(conversations);
  }, [backfillOwnershipFromConversations, collectionHydrated, conversations, startupReady]);
}
