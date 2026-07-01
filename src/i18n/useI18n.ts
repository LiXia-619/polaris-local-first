import { useMemo } from 'react';
import { useSpaceStore } from '../stores/spaceStore';
import { createTranslator } from './translator';

export function useI18n() {
  const language = useSpaceStore((state) => state.appLanguage);
  return useMemo(() => createTranslator(language), [language]);
}
