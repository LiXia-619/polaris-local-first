import { adjustColor, hsl } from './themeCoordinateSpaceLayout';
import type { BaseColor } from './themeCoordinateTypes';

export type ThemeCoordinateControlColorPlan = {
  surfaceTop: BaseColor;
  surfaceBottom: BaseColor;
  border: BaseColor;
  borderFocus: BaseColor;
  text: BaseColor;
  placeholder: BaseColor;
  ring: BaseColor;
  shadow: BaseColor;
};

type ControlTone = 'dark' | 'light' | 'mid';

function resolveControlTone(backgroundColor: BaseColor): ControlTone {
  if (backgroundColor.l < 40) return 'dark';
  if (backgroundColor.l > 76) return 'light';
  return 'mid';
}

export function resolveThemeCoordinateControlColorPlan(
  backgroundColor: BaseColor
): ThemeCoordinateControlColorPlan {
  const tone = resolveControlTone(backgroundColor);

  if (tone === 'dark') {
    return {
      surfaceTop: adjustColor(backgroundColor, { l: 16, s: -10 }),
      surfaceBottom: adjustColor(backgroundColor, { l: 9, s: -8 }),
      border: adjustColor(backgroundColor, { l: 29, s: -8 }),
      borderFocus: adjustColor(backgroundColor, { l: 42, s: 6, h: 8 }),
      text: adjustColor(backgroundColor, { l: 80, s: -18 }),
      placeholder: adjustColor(backgroundColor, { l: 58, s: -16 }),
      ring: adjustColor(backgroundColor, { l: 46, s: 12, h: 12 }),
      shadow: adjustColor(backgroundColor, { l: -10, s: 4 })
    };
  }

  if (tone === 'light') {
    return {
      surfaceTop: adjustColor(backgroundColor, { l: -7, s: -12 }),
      surfaceBottom: adjustColor(backgroundColor, { l: -13, s: -14 }),
      border: adjustColor(backgroundColor, { l: -25, s: -10 }),
      borderFocus: adjustColor(backgroundColor, { l: -38, s: 8, h: 8 }),
      text: adjustColor(backgroundColor, { l: -68, s: -22 }),
      placeholder: adjustColor(backgroundColor, { l: -44, s: -18 }),
      ring: adjustColor(backgroundColor, { l: -32, s: 10, h: 12 }),
      shadow: adjustColor(backgroundColor, { l: -48, s: -12 })
    };
  }

  return {
    surfaceTop: adjustColor(backgroundColor, { l: 14, s: -16 }),
    surfaceBottom: adjustColor(backgroundColor, { l: 7, s: -14 }),
    border: adjustColor(backgroundColor, { l: -18, s: -10 }),
    borderFocus: adjustColor(backgroundColor, { l: -28, s: 8, h: 8 }),
    text: adjustColor(backgroundColor, { l: -52, s: -22 }),
    placeholder: adjustColor(backgroundColor, { l: -30, s: -18 }),
    ring: adjustColor(backgroundColor, { l: -20, s: 12, h: 12 }),
    shadow: adjustColor(backgroundColor, { l: -34, s: -8 })
  };
}

export function buildThemeCoordinateControlStyleVars(
  backgroundColor: BaseColor
): Record<string, string> {
  const plan = resolveThemeCoordinateControlColorPlan(backgroundColor);

  return {
    '--control-surface': `linear-gradient(180deg, ${hsl(plan.surfaceTop, 0.88)}, ${hsl(plan.surfaceBottom, 0.84)})`,
    '--control-surface-focus': `linear-gradient(180deg, ${hsl(adjustColor(plan.surfaceTop, { l: 2 }), 0.92)}, ${hsl(adjustColor(plan.surfaceBottom, { l: 2 }), 0.88)})`,
    '--control-surface-solid': hsl(plan.surfaceBottom, 0.94),
    '--control-border-color': hsl(plan.border, 0.56),
    '--control-border': `1px solid ${hsl(plan.border, 0.56)}`,
    '--control-border-focus-color': hsl(plan.borderFocus, 0.78),
    '--control-border-focus': `1px solid ${hsl(plan.borderFocus, 0.78)}`,
    '--control-text': hsl(plan.text, 0.94),
    '--control-placeholder': hsl(plan.placeholder, 0.66),
    '--control-shadow': `0 10px 24px ${hsl(plan.shadow, 0.12)}, inset 0 1px 0 ${hsl(plan.surfaceTop, 0.42)}`,
    '--control-focus-shadow': `0 0 0 2.5px ${hsl(plan.ring, 0.2)}, 0 14px 30px ${hsl(plan.shadow, 0.14)}, inset 0 1px 0 ${hsl(plan.surfaceTop, 0.48)}`
  };
}
