import type { CollectionShelf, World } from '../../types/domain';

export function resolveRoomContextMode(args: {
  activeWorld: World;
  collectionShelf: CollectionShelf;
  hasActiveCard: boolean;
}): 'active' | 'available' {
  // If there is an active card, always expose its full content to the model.
  // A shallow regex must not decide whether the model gets to see the code.
  if (args.hasActiveCard) {
    return 'active';
  }

  if (args.activeWorld === 'collection' && args.collectionShelf === 'code') {
    return 'active';
  }

  return 'available';
}
