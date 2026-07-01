import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';

function copyTextThroughSelection(text: string) {
  if (typeof document === 'undefined' || !document.body) return false;

  const selection = document.getSelection();
  const previousRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index))
    : [];
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-999px';
  textarea.style.left = '-999px';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
    if (selection) {
      selection.removeAllRanges();
      previousRanges.forEach((range) => selection.addRange(range));
    }
    activeElement?.focus({ preventScroll: true });
  }

  return copied;
}

export async function writeTextToClipboard(text: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      await Clipboard.write({ string: text });
      return;
    } catch {
      // Fall back to WebView/browser clipboard paths below.
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      if (copyTextThroughSelection(text)) return;
      throw error;
    }
  }

  if (copyTextThroughSelection(text)) return;
  throw new Error('当前环境暂时不能写入剪贴板');
}
