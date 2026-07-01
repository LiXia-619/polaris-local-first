export type ThemeCoordinateGeneratedLayer = {
  layerId: string;
  cssText: string;
};

export type ThemeCoordinateGeneratedPatch = {
  comments?: string[];
  layers: ThemeCoordinateGeneratedLayer[];
};

