import type { ThemeToolScope } from '../../types/domain';
import type { ThemeCoordinatePreview } from './themeCoordinateSpaceMapping';
import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';
import {
  buildBackgroundRule,
  buildBubbleBorderRule,
  buildBubbleRule,
  buildChatTypographyRules,
  buildComposerRules,
  buildPanelRules,
  buildSystemNoteRule,
  buildTopbarBaseRule,
  buildTopbarRules
} from './themeCoordinateStableChatRules';
import {
  buildCardFaceRules,
  buildCardRules,
  buildMaterialRecessedRules,
  buildWoodFurnitureRules
} from './themeCoordinateStableExtraRules';
import { buildScopedVariableRules } from './themeCoordinateStableScopedVars';
import type { SurfaceTargetParts } from './themeCoordinateStableRuleShared';

export type { SurfaceTargetParts } from './themeCoordinateStableRuleShared';
export { buildScopedVariableRules } from './themeCoordinateStableScopedVars';

export function buildSurfaceRules(
  scope: ThemeToolScope,
  preview: ThemeCoordinatePreview,
  targets: ThemeCoordinateSurface[],
  targetParts?: SurfaceTargetParts
) {
  const rules: string[] = [];
  for (const target of targets) {
    const parts = targetParts?.[target];
    switch (target) {
      case 'background':
        rules.push(buildBackgroundRule(scope, preview));
        if (scope !== 'collection') {
          rules.push(buildChatTypographyRules(preview));
        }
        break;
      case 'topbar':
        rules.push(parts?.has('base') ? buildTopbarBaseRule(preview, scope) : buildTopbarRules(preview, scope));
        break;
      case 'chat-user-bubble':
        rules.push(parts?.has('border')
          ? buildBubbleBorderRule('chat-bubble-user', preview.surfaceSpecs['chat-user-bubble'], preview.surfaceTraits['chat-user-bubble'])
          : buildBubbleRule('chat-bubble-user', preview.surfaceSpecs['chat-user-bubble'], preview.surfaceTraits['chat-user-bubble']));
        break;
      case 'chat-ai-bubble':
        rules.push(parts?.has('border')
          ? buildBubbleBorderRule('chat-bubble-assistant', preview.surfaceSpecs['chat-ai-bubble'], preview.surfaceTraits['chat-ai-bubble'])
          : buildBubbleRule('chat-bubble-assistant', preview.surfaceSpecs['chat-ai-bubble'], preview.surfaceTraits['chat-ai-bubble']));
        break;
      case 'composer':
        rules.push(buildComposerRules(preview));
        break;
      case 'system-note':
        rules.push(buildSystemNoteRule(preview));
        break;
      case 'panel':
        rules.push(buildPanelRules(preview, scope));
        break;
      case 'card':
        rules.push(parts?.has('face') ? buildCardFaceRules(preview) : buildCardRules(preview));
        break;
      default:
        break;
    }
  }
  const woodFurnitureRules = buildWoodFurnitureRules(scope, preview);
  if (woodFurnitureRules) {
    rules.push(woodFurnitureRules);
  }
  const materialRecessedRules = targets.includes('card') ? buildMaterialRecessedRules(scope, preview) : '';
  if (materialRecessedRules) {
    rules.push(materialRecessedRules);
  }
  return rules.filter(Boolean).join('\n');
}
