import type { ThemeFrame, ThemePatchLedgerEntry, ThemePatchLedgerStatus, ThemeState } from '../types/domain';
import type { SpaceFrontstageState, SpaceState, SpaceThemeState } from './spaceStoreTypes';
import { patchThemeFields } from './spaceStoreActionShared';
import { applyThemeFrame, normalizeFrame, withSnapshot } from './spaceStoreTheme';
import { captureCollaboratorThemeSession, writeCurrentCollaboratorThemeSession } from './spaceStoreCollaboratorThemes';

type ScopedThemeMutationCarrier = Pick<
  SpaceState,
  'activeThemePreview' | 'theme' | 'customization' | 'collaboratorThemes' | 'frontstageCollaboratorId'
>;

export function clearActiveThemePreview<T extends Pick<SpaceState, 'activeThemePreview'>>(state: T) {
  return {
    ...state,
    activeThemePreview: null
  };
}

export function patchThemeSessionFields<T extends SpaceThemeState & Pick<SpaceFrontstageState, 'frontstageCollaboratorId'>>(
  state: T,
  patch: Partial<ThemeState>
) {
  return {
    ...patchThemeFields(state, patch),
    activeThemePreview: null
  };
}

export function appendThemePatchLedgerEntry(
  theme: ThemeState,
  entry: Omit<ThemePatchLedgerEntry, 'status' | 'createdAt' | 'updatedAt'>,
  now = Date.now()
): ThemeState {
  const existingLedger = theme.patchLedger.filter((item) => item.id !== entry.id && item.previewId !== entry.previewId);
  return {
    ...theme,
    patchLedger: [
      {
        ...entry,
        status: 'preview',
        createdAt: now,
        updatedAt: now
      },
      ...existingLedger
    ]
  };
}

export function markThemePatchLedgerStatus(
  theme: ThemeState,
  previewId: string,
  status: ThemePatchLedgerStatus,
  now = Date.now()
): ThemeState {
  let changed = false;
  const patchLedger = theme.patchLedger.map((entry) => {
    if (entry.previewId !== previewId) return entry;
    changed = true;
    return {
      ...entry,
      status,
      updatedAt: now
    };
  });
  return changed ? { ...theme, patchLedger } : theme;
}

export function replaceCommittedThemeFrame(
  state: ScopedThemeMutationCarrier,
  nextTheme: ThemeFrame
) {
  const theme = {
    ...applyThemeFrame(state.theme, normalizeFrame(state.theme, nextTheme)),
    skinHistory: withSnapshot(state.theme)
  };

  return {
    ...clearActiveThemePreview(state),
    theme,
    collaboratorThemes: writeCurrentCollaboratorThemeSession(
      state,
      captureCollaboratorThemeSession(theme, state.customization)
    )
  };
}

export function commitResolvedThemePreview(state: ScopedThemeMutationCarrier) {
  if (!state.activeThemePreview) return state;

  const activePreview = state.activeThemePreview;
  const previousTheme = applyThemeFrame(
    state.theme,
    normalizeFrame(state.theme, activePreview.before)
  );
  const committedTheme = {
    ...state.theme,
    skinHistory: withSnapshot(previousTheme)
  };
  const theme = markThemePatchLedgerStatus(committedTheme, activePreview.id, 'applied');
  const nextState = {
    ...clearActiveThemePreview(state),
    theme
  };

  return {
    ...nextState,
    collaboratorThemes: writeCurrentCollaboratorThemeSession(
      state,
      captureCollaboratorThemeSession(theme, state.customization)
    )
  };
}

export function replaceResolvedThemeFrame(
  state: ScopedThemeMutationCarrier,
  nextTheme: ThemeFrame,
  options?: {
    skinHistory?: ThemeState['skinHistory'];
    patchLedger?: ThemeState['patchLedger'];
  }
) {
  const resolvedTheme = applyThemeFrame(state.theme, normalizeFrame(state.theme, nextTheme));
  const theme = {
    ...resolvedTheme,
    ...(options?.skinHistory ? { skinHistory: options.skinHistory } : {}),
    ...(options?.patchLedger ? { patchLedger: options.patchLedger } : {})
  };
  const nextState = {
    ...clearActiveThemePreview(state),
    theme
  };

  return {
    ...nextState,
    collaboratorThemes: writeCurrentCollaboratorThemeSession(
      state,
      captureCollaboratorThemeSession(nextState.theme, state.customization)
    )
  };
}

export function replaceResolvedThemeFrameAndMarkPreview(
  state: ScopedThemeMutationCarrier,
  nextTheme: ThemeFrame,
  previewId: string,
  status: ThemePatchLedgerStatus
) {
  const themeWithStatus = markThemePatchLedgerStatus(state.theme, previewId, status);
  return replaceResolvedThemeFrame(
    { ...state, theme: themeWithStatus },
    nextTheme,
    { patchLedger: themeWithStatus.patchLedger }
  );
}
