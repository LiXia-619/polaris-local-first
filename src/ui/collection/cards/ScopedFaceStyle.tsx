type ScopedFaceStyleProps = {
  css: string;
};

export function ScopedFaceStyle({ css }: ScopedFaceStyleProps) {
  const scopedCss = css.trim();
  if (!scopedCss) return null;

  return (
    <style hidden aria-hidden="true" style={{ display: 'none' }}>
      {scopedCss}
    </style>
  );
}
