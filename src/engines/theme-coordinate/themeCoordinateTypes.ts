import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';
import type { ThemeCoordinateStyleFamily } from './themeCoordinateStyleFamily';

export type ThemeCoordinateState = {
  hue: number;
  hueCount: number;
  emotion: number;
  meaning: number;
  seed: number;
  baseColor?: string;
};

export type ThemeCoordinateSurfaceSpec = {
  styleFamily: ThemeCoordinateStyleFamily;
  fill: string;
  borderPaint: string;
  borderWidth: string;
  borderStyle: string;
  radius: string;
  shadow: string;
  text: string;
  muted: string;
  accent: string;
  blur: string;
  padding: string;
  lineHeight: string;
  letterSpacing: string;
  textureLabel: string;
  edgeLabel: string;
  ornamentLabel: string;
  gradientLabel: string;
};

export type BaseColor = {
  h: number;
  s: number;
  l: number;
};

export type ThemeCoordinateSurfaceMap<T> = Record<ThemeCoordinateSurface, T>;
