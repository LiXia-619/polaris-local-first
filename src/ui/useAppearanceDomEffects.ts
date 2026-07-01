import { useEffect, useState } from 'react';
import type { AppAppearancePreference } from '../types/domain';

type ResolvedAppearance = 'light' | 'dark';

const DARK_THEME_COLOR = '#090b14';
const LIGHT_THEME_COLOR = '#ffffff';
const APPEARANCE_MEDIA_QUERY = '(prefers-color-scheme: dark)';
const APPEARANCE_STORAGE_KEY = 'polaris-appearance-preference';

function resolveSystemAppearance() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(APPEARANCE_MEDIA_QUERY).matches ? 'dark' : 'light';
}

function resolveAppearance(preference: AppAppearancePreference): ResolvedAppearance {
  return preference === 'system' ? resolveSystemAppearance() : preference;
}

function ensureThemeColorMeta() {
  const existing = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (existing) return existing;

  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  document.head.appendChild(meta);
  return meta;
}

function mirrorAppearancePreference(preference: AppAppearancePreference) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, preference);
  } catch {
    // Best-effort startup hint only; the real preference still lives in the store.
  }
}

export function useAppearanceDomEffects(preference: AppAppearancePreference) {
  const [systemAppearance, setSystemAppearance] = useState<ResolvedAppearance>(() => resolveSystemAppearance());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(APPEARANCE_MEDIA_QUERY);
    const syncSystemAppearance = () => {
      setSystemAppearance(mediaQuery.matches ? 'dark' : 'light');
    };
    syncSystemAppearance();
    mediaQuery.addEventListener('change', syncSystemAppearance);
    return () => {
      mediaQuery.removeEventListener('change', syncSystemAppearance);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const resolvedAppearance = preference === 'system' ? systemAppearance : resolveAppearance(preference);
    const root = document.documentElement;
    root.dataset.polarisAppearance = resolvedAppearance;
    root.dataset.polarisAppearancePreference = preference;
    root.style.colorScheme = resolvedAppearance;
    ensureThemeColorMeta().content = resolvedAppearance === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
    mirrorAppearancePreference(preference);
  }, [preference, systemAppearance]);
}
