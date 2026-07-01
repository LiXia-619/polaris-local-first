import type { ThemeToolScope } from '../../types/domain';
import { getThemeCoordinateSurfaceExtraGlobalKeys } from './themeCoordinateSelection';
import type { ThemeCoordinatePreview } from './themeCoordinateSpaceMapping';
import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';
import {
  CHAT_SCOPE_KEYS,
  COLLECTION_SCOPE_KEYS,
  buildVarDeclarations,
  hasWholeSurfaceSelection,
  unique,
  type SurfaceTargetParts
} from './themeCoordinateStableRuleShared';

export function buildScopedVariableRules(
  scope: ThemeToolScope,
  preview: ThemeCoordinatePreview,
  targets: ThemeCoordinateSurface[],
  targetParts?: SurfaceTargetParts
) {
  const rules: string[] = [];
  const hasBackground = targets.includes('background');
  const hasCard = targets.includes('card');
  const hasUserBubble = targets.includes('chat-user-bubble');
  const hasPanel = targets.includes('panel');

  if (scope === 'app' && hasBackground) {
    const appVars = Object.keys(preview.styleVars).filter((key) => !key.startsWith('--tc-'));
    rules.push(`:root,\n.app-shell {\n${buildVarDeclarations(preview.styleVars, appVars)}\n}`);
    return rules;
  }

  if (scope === 'chat' && (hasBackground || hasUserBubble || hasPanel)) {
    const keys = unique([
      ...(hasBackground ? CHAT_SCOPE_KEYS : []),
      ...(hasUserBubble && hasWholeSurfaceSelection(targetParts, 'chat-user-bubble')
        ? getThemeCoordinateSurfaceExtraGlobalKeys('chat-user-bubble')
        : []),
      ...(hasPanel && hasWholeSurfaceSelection(targetParts, 'panel')
        ? getThemeCoordinateSurfaceExtraGlobalKeys('panel')
        : [])
    ]);
    rules.push(`.app-shell.chat {\n${buildVarDeclarations(preview.styleVars, keys)}\n}`);
  }

  if (scope === 'collection' && (hasBackground || hasCard || hasPanel)) {
    const keys = unique([
      ...(hasBackground ? COLLECTION_SCOPE_KEYS : []),
      ...(hasCard && hasWholeSurfaceSelection(targetParts, 'card')
        ? getThemeCoordinateSurfaceExtraGlobalKeys('card')
        : []),
      ...(hasPanel && hasWholeSurfaceSelection(targetParts, 'panel')
        ? getThemeCoordinateSurfaceExtraGlobalKeys('panel')
        : [])
    ]);
    rules.push(`.app-shell.collection {\n${buildVarDeclarations(preview.styleVars, keys)}\n}`);
  }

  return rules;
}
