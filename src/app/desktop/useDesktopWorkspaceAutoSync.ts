export function useDesktopWorkspaceAutoSync() {
  // Desktop folder movement is intentionally manual: phone may send a workspace to Mac,
  // but Mac disk changes must not silently flow back into mobile state.
  return;
}
