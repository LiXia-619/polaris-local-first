type FocusCandidate = {
  blur?: () => void;
  closest?: (selector: string) => unknown;
  isContentEditable?: boolean;
  tagName?: string;
  type?: string;
};

function isFocusCandidate(node: unknown): node is FocusCandidate {
  return typeof node === 'object' && node !== null;
}

function isTextEntryElement(node: FocusCandidate) {
  if (node.isContentEditable) return true;
  const tagName = node.tagName?.toLowerCase();
  if (tagName === 'textarea' || tagName === 'select') return true;
  if (tagName !== 'input') return false;

  const inputType = node.type?.toLowerCase() ?? 'text';
  return inputType !== 'button' && inputType !== 'checkbox' && inputType !== 'radio';
}

export function shouldBlurChatWorldFocus(node: unknown) {
  if (!isFocusCandidate(node) || !isTextEntryElement(node)) return false;
  return Boolean(node.closest?.('.chat-frame'));
}

export function blurChatWorldFocus(node: unknown) {
  if (!shouldBlurChatWorldFocus(node) || !isFocusCandidate(node)) return false;
  node.blur?.();
  return true;
}
