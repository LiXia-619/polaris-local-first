import { THEME_PRESETS, DEFAULT_THEME_PRESET_ID } from '../../config/theme/themePresets';

function clipSentence(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}...`;
}

export function buildThemePresetSummaryLine() {
  return `presetId 速查：${THEME_PRESETS.map((preset) => {
    const defaultLabel = preset.id === DEFAULT_THEME_PRESET_ID ? '*' : '';
    return `${preset.id}${defaultLabel}=${clipSentence(preset.mood, 8)}`;
  }).join(' / ')}`;
}
