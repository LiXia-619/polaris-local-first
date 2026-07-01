export function buildRoomRulePreviewLines(code: string, fallback: string[]) {
  const lines = code
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-#*\d.\s]+/, '').trim())
    .filter(Boolean);

  return (lines.length > 0 ? lines : fallback).slice(0, 3);
}
