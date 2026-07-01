import { useInsertionEffect } from 'react';

type ScopedCardFaceStyleProps = {
  ownerId: string;
  cssText: string;
};

export function ScopedCardFaceStyle({ ownerId, cssText }: ScopedCardFaceStyleProps) {
  useInsertionEffect(() => {
    const normalizedCss = cssText.trim();
    if (!normalizedCss || typeof document === 'undefined') return;

    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-polaris-card-face-style', ownerId);
    styleElement.textContent = normalizedCss;
    document.head.appendChild(styleElement);

    return () => {
      styleElement.remove();
    };
  }, [cssText, ownerId]);

  return null;
}
