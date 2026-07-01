import { create } from 'zustand';
import { createSpaceFrontstageSlice } from './spaceStoreFrontstageSlice';
import { createSpaceThemeSessionSlice } from './spaceStoreThemeSessionSlice';
import type { SpaceState } from './spaceStoreTypes';

export type { ActiveThemePreview, SpaceState } from './spaceStoreTypes';

// Ordinary space persistence is LocalData-only: the store is persisted by the persistent-store
// flush (`writePersistedSpaceThemeState`, which writes the LocalData space rows and self-activates
// the domain on first write) and hydrated by the persistent-store hydration
// (`readPersistedSpaceThemeState`). The store deliberately does NOT use the zustand `persist`
// middleware, so it never writes or rehydrates the legacy `polaris-space-store-v1` localStorage
// mirror. That key now exists only at the explicit import / export / migration / recovery
// boundaries; a normal startup never reads it.
export const useSpaceStore = create<SpaceState>()((set) => ({
  ...createSpaceFrontstageSlice(set),
  ...createSpaceThemeSessionSlice(set)
}));
