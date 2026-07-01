import { normalizeAppLayoutSurface, type AppLayoutSurface } from '../shell/appLayoutSurface';

export type RequestedAppLayoutSurface = AppLayoutSurface;

export function resolveRequestedAppLayoutSurface(search: string | URLSearchParams) {
  const searchParams = typeof search === 'string' ? new URLSearchParams(search) : search;
  const requestedLayout = normalizeAppLayoutSurface(searchParams.get('layout'));
  if (requestedLayout) return requestedLayout;

  return normalizeAppLayoutSurface(searchParams.get('surface'));
}

export function applyAppLayoutSurfaceBootstrap(root: HTMLElement, search: string | URLSearchParams) {
  const requestedSurface = resolveRequestedAppLayoutSurface(search);

  if (!requestedSurface) {
    return null;
  }

  root.dataset.polarisLayoutSurface = requestedSurface;
  delete root.dataset.polarisSurface;
  return requestedSurface;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  applyAppLayoutSurfaceBootstrap(document.documentElement, window.location.search);
}
