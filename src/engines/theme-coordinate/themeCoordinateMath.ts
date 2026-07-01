export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function wrapHue(hue: number) {
  const wrapped = hue % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}
