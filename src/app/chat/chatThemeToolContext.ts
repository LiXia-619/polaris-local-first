import { findThemeSurfaceEntryByCode } from '../../config/theme/themeSurfaceRegistry';
import { buildThemeSelectorHints, type ThemeSelectorHint } from '../../engines/tool-protocol/themeSelectorPromptCatalog';
import {
  buildThemeCoordinateFocusedSurfaceSnapshot,
  normalizeThemeCoordinateSurfaceCode
} from '../../engines/theme-coordinate/themeCoordinateSurfaceTokens';
import {
  THEME_COORDINATE_SURFACE_CODE
} from '../../engines/theme-coordinate/themeCoordinateSurfaceMeta';
import type {
  ChatMessage,
  ThemeFrame,
  ToolInvocation,
  ThemeToolMode,
  World,
  CollectionShelf,
  ModelTier
} from '../../types/domain';
import type { AssistantToolContext, AssistantToolContextMode } from '../../engines/tool-protocol/assistantToolProtocolTypes';
import { buildExplicitThemeSurfaceCodes, isRecentThemeToolInvocation } from './themeRequestSignals';

function buildThemeFocus(messages: ChatMessage[]): AssistantToolContext['themeFocus'] {
  const recentMessage = [...messages].reverse().find((message) => isRecentThemeToolInvocation(message.toolInvocation));
  const tool = recentMessage?.toolInvocation;
  if (!tool) return undefined;

  const recentSurfaceLabels = Array.from(new Set([
    ...(tool.themeSurfaceLabels ?? []),
    tool.targetLabel ?? null,
    tool.themeIntentLabel ?? null
  ].filter((value): value is string => Boolean(value?.trim())))).slice(0, 4);
  const scopeLabel = tool.themeScope === 'app'
    ? '整页'
    : tool.themeScope === 'collection'
      ? '收藏区局部'
      : tool.themeScope === 'chat'
        ? '对话区局部'
        : undefined;

  if (!scopeLabel && recentSurfaceLabels.length === 0 && !tool.summary.trim()) {
    return undefined;
  }

  return {
    scopeLabel,
    recentSurfaceLabels,
    recentSummary: tool.summary.trim() || undefined,
    avoidGlobalPreset: tool.themeScope !== 'app'
  };
}

function isTerminalToolInvocation(tool: ToolInvocation | undefined) {
  return tool?.status === 'executed' || tool?.status === 'applied' || tool?.status === 'saved';
}

function buildRecentToolHistory(messages: ChatMessage[]): AssistantToolContext['recentToolHistory'] {
  const recentMessage = [...messages].reverse().find((message) => isTerminalToolInvocation(message.toolInvocation));
  const tool = recentMessage?.toolInvocation;
  if (!tool) return undefined;

  const summary = tool.summary.trim();
  return {
    kind: tool.kind,
    title: tool.title,
    summary: summary ? summary.slice(0, 140) : undefined,
    targetLabel: tool.targetLabel?.trim() || undefined,
    status: tool.status as 'executed' | 'applied' | 'saved'
  };
}

function dedupeSurfaceCodes(values: Array<string | null | undefined>) {
  return Array.from(new Set(
    values
      .map((value) => (typeof value === 'string' ? normalizeThemeCoordinateSurfaceCode(value) : null))
      .filter((value): value is string => Boolean(value))
  ));
}

function buildRecentThemeSurfaceCodes(messages: ChatMessage[]) {
  const recentMessage = [...messages].reverse().find((message) => isRecentThemeToolInvocation(message.toolInvocation));
  const tool = recentMessage?.toolInvocation;
  if (!tool) return [];
  return dedupeSurfaceCodes(tool.themeSurfaceIds ?? []);
}

function defaultWorldFocusSurfaceCodes(activeWorld: World) {
  if (activeWorld === 'collection') {
    return [
      THEME_COORDINATE_SURFACE_CODE.card,
      THEME_COORDINATE_SURFACE_CODE.panel,
      THEME_COORDINATE_SURFACE_CODE.background,
      THEME_COORDINATE_SURFACE_CODE.topbar
    ];
  }
  return [
    THEME_COORDINATE_SURFACE_CODE['chat-user-bubble'],
    THEME_COORDINATE_SURFACE_CODE.composer,
    THEME_COORDINATE_SURFACE_CODE.background,
    THEME_COORDINATE_SURFACE_CODE.topbar
  ];
}

export function resolveStableSnapshotFocus(args: {
  explicitSurfaceCodes: string[];
  selectedSurfaceCodes: string[];
  recentThemeSurfaceCodes: string[];
  activeWorld: World;
}) {
  const explicitSurfaceCodes = dedupeSurfaceCodes(args.explicitSurfaceCodes);
  if (explicitSurfaceCodes.length > 0) {
    return {
      focusSource: 'user-hint' as const,
      focusSurfaceCodes: explicitSurfaceCodes
    };
  }

  const selectedSurfaceCodes = dedupeSurfaceCodes(args.selectedSurfaceCodes);
  if (selectedSurfaceCodes.length > 0) {
    return {
      focusSource: 'selected' as const,
      focusSurfaceCodes: selectedSurfaceCodes
    };
  }

  const recentThemeSurfaceCodes = dedupeSurfaceCodes(args.recentThemeSurfaceCodes);
  if (recentThemeSurfaceCodes.length > 0) {
    return {
      focusSource: 'recent-tool' as const,
      focusSurfaceCodes: recentThemeSurfaceCodes
    };
  }

  return {
    focusSource: 'world-default' as const,
    focusSurfaceCodes: defaultWorldFocusSurfaceCodes(args.activeWorld)
  };
}

function buildStableSurfaceSnapshotSummary(args: {
  focusSource: NonNullable<AssistantToolContext['stableSurfaceSnapshotSummary']>['focusSource'];
  focusSurfaceCodes: string[];
}): NonNullable<AssistantToolContext['stableSurfaceSnapshotSummary']> {
  const includedSurfaceCodes = args.focusSurfaceCodes.length <= 3
    ? args.focusSurfaceCodes
    : args.focusSurfaceCodes.slice(0, 1);
  const summarizedSurfaceCodes = args.focusSurfaceCodes.length > 3
    ? args.focusSurfaceCodes.slice(1)
    : [];
  const labelFor = (code: string) => findThemeSurfaceEntryByCode(code)?.label ?? code;

  return {
    focusSource: args.focusSource,
    includedSurfaceCodes,
    includedSurfaceLabels: includedSurfaceCodes.map(labelFor),
    summarizedSurfaceCodes,
    summarizedSurfaceLabels: summarizedSurfaceCodes.map(labelFor)
  };
}

export function buildThemeToolContext(args: {
  messages: ChatMessage[];
  activeWorld: World;
  collectionShelf: CollectionShelf;
  themeToolMode: ThemeToolMode;
  themePreviewActive: boolean;
  selectedSurfaceCodes: string[];
  currentThemeFrame: ThemeFrame;
  recentThemeToolModeSwitch?: {
    from: ThemeToolMode;
    to: ThemeToolMode;
  };
  modelTier: ModelTier;
  enabledToolGroups?: AssistantToolContext['enabledToolGroups'];
  chatAvatarLayoutEnabled?: boolean;
}) {
  const themeContextMode: AssistantToolContextMode =
    args.themeToolMode !== 'off' && args.themePreviewActive
      ? 'focused'
      : 'none';
  const latestUserMessage = [...args.messages].reverse().find((message) => message.role === 'user');
  const explicitSurfaceCodes = buildExplicitThemeSurfaceCodes(latestUserMessage?.content);
  const recentThemeSurfaceCodes = buildRecentThemeSurfaceCodes(args.messages);
  const themeFocus = buildThemeFocus(args.messages);
  const recentToolHistory = buildRecentToolHistory(args.messages);
  const selectorRequestText = [
    latestUserMessage?.content,
    themeFocus?.scopeLabel,
    ...(themeFocus?.recentSurfaceLabels ?? []),
    themeFocus?.recentSummary,
    recentToolHistory?.targetLabel,
    recentToolHistory?.summary
  ].filter(Boolean).join('\n');
  const { focusSource, focusSurfaceCodes } = resolveStableSnapshotFocus({
    explicitSurfaceCodes,
    selectedSurfaceCodes: args.selectedSurfaceCodes,
    recentThemeSurfaceCodes,
    activeWorld: args.activeWorld
  });
  const selectorHints: ThemeSelectorHint[] =
    args.themeToolMode === 'creative'
      ? buildThemeSelectorHints({
          activeWorld: args.activeWorld,
          collectionShelf: args.collectionShelf,
          modelTier: args.modelTier,
          requestText: selectorRequestText,
          chatAvatarLayoutEnabled: args.chatAvatarLayoutEnabled
        })
      : [];
  const focusedSurfaceSnapshot =
    args.themeToolMode === 'stable' && focusSurfaceCodes[0]
      ? buildThemeCoordinateFocusedSurfaceSnapshot({
          surfaceCode: focusSurfaceCodes[0],
          beforeGeneratedCss: args.currentThemeFrame.generatedCSS
        })
      : null;
  const stableSurfaceSnapshots =
    args.themeToolMode === 'stable'
      ? (focusSurfaceCodes.length <= 3 ? focusSurfaceCodes.slice(1) : []).map((surfaceCode) =>
          buildThemeCoordinateFocusedSurfaceSnapshot({
            surfaceCode,
            beforeGeneratedCss: args.currentThemeFrame.generatedCSS
          })
        ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      : [];
  const stableSurfaceSnapshotSummary =
    args.themeToolMode === 'stable'
      ? buildStableSurfaceSnapshotSummary({
          focusSource,
          focusSurfaceCodes
        })
      : undefined;

  return {
    selectorHints,
    toolContext: {
      themeContextMode,
      themeFocus,
      themeModeSwitchHint: args.recentThemeToolModeSwitch,
      recentToolHistory,
      modelTier: args.modelTier,
      enabledToolGroups: args.enabledToolGroups,
      themeToolMode: args.themeToolMode,
      focusedSurfaceSnapshot: focusedSurfaceSnapshot ?? undefined,
      stableSurfaceSnapshots,
      stableSurfaceSnapshotSummary,
      toolEnforcementMode: 'normal',
      toolEnforcementScope: undefined,
      themePreviewActive: args.themePreviewActive,
      themeSnapshot: args.currentThemeFrame
    } satisfies Pick<
      AssistantToolContext,
      | 'themeContextMode'
      | 'themeFocus'
      | 'themeModeSwitchHint'
      | 'recentToolHistory'
      | 'modelTier'
      | 'enabledToolGroups'
      | 'themeToolMode'
      | 'focusedSurfaceSnapshot'
      | 'stableSurfaceSnapshots'
      | 'stableSurfaceSnapshotSummary'
      | 'toolEnforcementMode'
      | 'toolEnforcementScope'
      | 'themePreviewActive'
      | 'themeSnapshot'
    >
  };
}
