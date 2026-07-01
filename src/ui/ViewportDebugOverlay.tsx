type ViewportDebugOverlayProps = {
  activeTag: string;
  enabled: boolean;
  innerHeight: number;
  keyboardOffset: number;
  scrollY: number;
  viewportHeight: number;
  viewportTop: number;
};

export function ViewportDebugOverlay({
  activeTag,
  enabled,
  innerHeight,
  keyboardOffset,
  scrollY,
  viewportHeight,
  viewportTop
}: ViewportDebugOverlayProps) {
  if (!enabled) return null;

  return (
    <div className="viewport-debug-overlay">
      <strong>viewport debug</strong>
      <span>{`scrollY ${scrollY}`}</span>
      <span>{`innerH ${innerHeight}`}</span>
      <span>{`vvH ${viewportHeight}`}</span>
      <span>{`vvTop ${viewportTop}`}</span>
      <span>{`kbd ${keyboardOffset}`}</span>
      <span>{`focus ${activeTag}`}</span>
    </div>
  );
}
