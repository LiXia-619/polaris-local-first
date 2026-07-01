import { buildThemeFrameFromPresetId } from '../config/theme/themePresets';
import { buildThemeCoordinateGlobalTheme } from './theme-coordinate/themeCoordinateGlobalTheme';
import { buildThemeCoordinateSurfaceTokenPatch } from './theme-coordinate/themeCoordinateSurfaceTokens';
import { normalizeThemeCoordinateSurfaceRefs } from './theme-coordinate/themeCoordinateStableAction';
import type { ToolAction } from './toolExecutorTypes';
import {
  appendThemeCssFile,
  deleteThemeCssFile,
  editThemeCssFile,
  insertThemeCssFile,
  replaceThemeCssFile
} from './themeCssFile';
import { mergeThemeCssLayers, resolveCreativeCssPatch, serializeThemeCoordinateGeneratedPatch } from './themeCssLayers';
import type { ThemeFrame } from '../types/domain';

type ThemePresetCustomCssMode = 'preserve-current' | 'replace-with-preset';

type ThemeActionFrameResult =
  | {
      ok: true;
      nextTheme: ThemeFrame;
      generatedCssPatch?: string;
    }
  | {
      ok: false;
      error?: string;
      unsupported: boolean;
    };

export function applyGeneratedThemePatchToFrame(
  beforeTheme: ThemeFrame,
  generatedCssPatch?: string
): ThemeFrame {
  return {
    ...beforeTheme,
    activeSavedSkinId: null,
    generatedCSS: generatedCssPatch
      ? mergeThemeCssLayers(beforeTheme.generatedCSS, generatedCssPatch)
      : beforeTheme.generatedCSS
  };
}

export function resolveThemeActionFrameChange(
  beforeTheme: ThemeFrame,
  action: ToolAction,
  options?: {
    presetCustomCssMode?: ThemePresetCustomCssMode;
  }
): ThemeActionFrameResult {
  switch (action.kind) {
    case 'applyThemeCoordinates': {
      const targets = action.targets === 'all'
        ? 'all'
        : normalizeThemeCoordinateSurfaceRefs(action.targets)
            .map((surface) => surface);
      const result = buildThemeCoordinateGlobalTheme({
        targets,
        hue: action.hue,
        hueCount: action.hueCount,
        emotion: action.emotion,
        meaning: action.meaning,
        baseColor: action.baseColor,
        seed: action.seed,
        beforeGeneratedCss: beforeTheme.generatedCSS,
        label: action.label
      });
      const generatedCssPatch = serializeThemeCoordinateGeneratedPatch(result.generatedPatch);
      return {
        ok: true,
        nextTheme: applyGeneratedThemePatchToFrame(beforeTheme, generatedCssPatch),
        generatedCssPatch
      };
    }
    case 'applySurfaceTokens': {
      const result = buildThemeCoordinateSurfaceTokenPatch({
        action,
        beforeGeneratedCss: beforeTheme.generatedCSS
      });
      const generatedCssPatch = serializeThemeCoordinateGeneratedPatch(result.generatedPatch);
      return {
        ok: true,
        nextTheme: applyGeneratedThemePatchToFrame(beforeTheme, generatedCssPatch),
        generatedCssPatch
      };
    }
    case 'applyPreset': {
      const presetFrame = buildThemeFrameFromPresetId(action.presetId);
      return {
        ok: true,
        nextTheme:
          options?.presetCustomCssMode === 'preserve-current'
            ? {
                ...presetFrame,
                customCSS: beforeTheme.customCSS,
                generatedCSS: ''
              }
            : presetFrame
      };
    }
    case 'patchRawCss': {
      const patchResult = resolveCreativeCssPatch(action);
      if (!patchResult.ok) {
        return {
          ok: false,
          error: patchResult.error,
          unsupported: false
        };
      }
      return {
        ok: true,
        nextTheme: applyGeneratedThemePatchToFrame(beforeTheme, patchResult.generatedCssPatch),
        generatedCssPatch: patchResult.generatedCssPatch
      };
    }
    case 'editThemeCss': {
      const editResult = editThemeCssFile({
        theme: beforeTheme,
        oldString: action.oldString,
        newString: action.newString,
        layer: action.layer
      });
      if (!editResult.ok) {
        return {
          ok: false,
          error: editResult.error,
          unsupported: false
        };
      }
      return {
        ok: true,
        nextTheme: editResult.nextTheme,
        generatedCssPatch: action.newString
      };
    }
    case 'appendThemeCss': {
      const appendResult = appendThemeCssFile({
        theme: beforeTheme,
        css: action.css,
        layer: action.layer
      });
      if (!appendResult.ok) {
        return {
          ok: false,
          error: appendResult.error,
          unsupported: false
        };
      }
      return {
        ok: true,
        nextTheme: appendResult.nextTheme,
        generatedCssPatch: appendResult.writtenCss ?? action.css
      };
    }
    case 'insertThemeCss': {
      const insertResult = insertThemeCssFile({
        theme: beforeTheme,
        anchorString: action.anchorString,
        css: action.css,
        position: action.position,
        layer: action.layer
      });
      if (!insertResult.ok) {
        return {
          ok: false,
          error: insertResult.error,
          unsupported: false
        };
      }
      return {
        ok: true,
        nextTheme: insertResult.nextTheme,
        generatedCssPatch: insertResult.writtenCss ?? action.css
      };
    }
    case 'deleteThemeCss': {
      const deleteResult = deleteThemeCssFile({
        theme: beforeTheme,
        oldString: action.oldString,
        layer: action.layer
      });
      if (!deleteResult.ok) {
        return {
          ok: false,
          error: deleteResult.error,
          unsupported: false
        };
      }
      return {
        ok: true,
        nextTheme: deleteResult.nextTheme,
        generatedCssPatch: ''
      };
    }
    case 'replaceThemeCss': {
      const replaceResult = replaceThemeCssFile(action.css);
      if (!replaceResult.ok) {
        return {
          ok: false,
          error: replaceResult.error,
          unsupported: false
        };
      }
      return {
        ok: true,
        nextTheme: replaceResult.nextTheme,
        generatedCssPatch: replaceResult.writtenCss ?? action.css
      };
    }
    default:
      return {
        ok: false,
        unsupported: true
      };
  }
}
