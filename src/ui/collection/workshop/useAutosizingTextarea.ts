import { useLayoutEffect, type RefObject } from 'react';

export function useAutosizingTextarea(
  textareaRef: RefObject<HTMLTextAreaElement>,
  value: string
) {
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [textareaRef, value]);
}
