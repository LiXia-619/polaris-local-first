import type { AssistantToolContext } from './assistantToolProtocolTypes';
import { buildCreativeThemeToolRules } from './toolRegistryThemeRulesCreative';
import { buildStableThemeToolRules } from './toolRegistryThemeRulesStable';
export { buildThemeSnapshotPrompt } from './toolRegistryThemeRulesShared';

export function buildThemeToolRules(context?: AssistantToolContext) {
  return (context?.themeToolMode ?? 'stable') === 'creative'
    ? buildCreativeThemeToolRules(context)
    : buildStableThemeToolRules(context);
}
