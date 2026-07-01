import { mkdir, writeFile } from 'node:fs/promises';
import { extractAssistantToolActions } from '../src/engines/assistantToolProtocol.ts';
import { extractOpenAiCompatibleReply } from '../src/engines/provider-runtime/providerRuntimeResponsePayload.ts';
import { parseAssistantReplyContent } from '../src/app/chat/chatReplyContent.ts';
import { buildCustomThemeFrame } from '../src/config/themePresets.ts';
import { THEME_PRESETS } from '../src/config/themePresetCatalog.ts';
import { getThemePresetStableProfile } from '../src/config/themePresetStableProfiles.ts';
import { parseThemeLayers } from '../src/engines/themeCssLayerBlocks.ts';
import { resolveThemeActionFrameChange } from '../src/engines/themeToolState.ts';
import { createToolPreviewController } from '../src/app/chat/chatToolPreviewController.ts';

const outDir = process.env.OUT_DIR ?? 'tmp';
const report = {
  reportKind: 'stable-local',
  generatedAt: new Date().toISOString(),
  presetChecks: await validatePresetRoute(),
  parserChecks: await validateStableParser(),
  coordinateChecks: await validateCoordinateRoute(),
  previewFlowChecks: await validatePreviewFlow()
};

await mkdir(outDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = `${outDir}/stable-theme-local-validation-${timestamp}.json`;
await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

console.log(renderSummary(report));
console.log(`\nJSON -> ${outputPath}`);

async function validatePresetRoute() {
  const before = buildCustomThemeFrame();
  const checks = [];

  for (const preset of THEME_PRESETS) {
    const profile = getThemePresetStableProfile(preset.id);
    const result = resolveThemeActionFrameChange(
      before,
      { kind: 'applyPreset', presetId: preset.id },
      { presetCustomCssMode: 'preserve-current' }
    );

    checks.push({
      presetId: preset.id,
      hasStableProfile: Boolean(profile),
      ok: result.ok,
      activePresetId: result.ok ? result.nextTheme.activePresetId : null,
      generatedCss: result.ok ? Boolean(result.nextTheme.generatedCSS) : false,
      recipeName: result.ok ? result.nextTheme.recipe?.name ?? null : null,
      error: result.ok ? null : result.error ?? 'unknown'
    });
  }

  return checks;
}

async function validateStableParser() {
  const reply = extractOpenAiCompatibleReply({
    model: 'stable-local-test',
    choices: [
      {
        message: {
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'applyThemeCoordinates',
                arguments: JSON.stringify({
                  targets: 'all',
                  hue: 220,
                  hueCount: 3,
                  emotion: -2,
                  meaning: 5,
                  seed: 7,
                  label: '整页 · 冷静蓝夜'
                })
              }
            }
          ]
        }
      }
    ]
  }, 'stable-local-test');
  const parsed = parseAssistantReplyContent(
    reply.content,
    'medium',
    'stable',
    'final',
    reply.nativeToolCalls ?? []
  ).parsed;
  const first = parsed.actions[0];

  const inferredFallback = extractAssistantToolActions(
    '```polaris-tools\n{"actions":[{"kind":"applySurfaceTokens","targets":["05"],"surface":"05","spell":"glass","blur":18,"opacity":0.88,"label":"发送栏 · 轻玻璃"}]}\n```',
    'medium',
    'stable'
  );

  return {
    nativeToolCallCount: reply.nativeToolCallCount ?? 0,
    parsedActionKind: first?.kind ?? null,
    parsedTargets: first?.kind === 'applyThemeCoordinates' ? first.targets : null,
    parsedIssues: parsed.issues,
    inferredKinds: inferredFallback.actions.map((action) => action.kind),
    inferredIssues: inferredFallback.issues
  };
}

async function validateCoordinateRoute() {
  const before = buildCustomThemeFrame();
  const baseAction = {
    kind: 'applyThemeCoordinates',
    targets: 'all',
    hue: 220,
    hueCount: 3,
    emotion: -2,
    meaning: 5,
    label: '整页 · 冷静蓝夜'
  };

  const sameA = resolveThemeActionFrameChange(before, {
    ...baseAction,
    seed: 7
  });
  const sameB = resolveThemeActionFrameChange(before, {
    ...baseAction,
    seed: 7
  });
  const diff = resolveThemeActionFrameChange(before, {
    ...baseAction,
    seed: 9
  });
  const surface = resolveThemeActionFrameChange(before, {
    kind: 'applySurfaceTokens',
    targets: ['05'],
    surface: '05',
    spell: 'glass',
    blur: 18,
    opacity: 0.88,
    radius: 28,
    borderW: 1,
    label: '发送栏 · 轻玻璃'
  });

  if (!sameA.ok || !sameB.ok || !diff.ok || !surface.ok) {
    return {
      ok: false,
      error: !sameA.ok
        ? sameA.error ?? 'sameA failed'
        : !sameB.ok
          ? sameB.error ?? 'sameB failed'
          : !diff.ok
            ? diff.error ?? 'diff failed'
            : surface.error ?? 'surface failed'
    };
  }

  const coordinateLayers = parseThemeLayers(sameA.generatedCssPatch ?? '').layers;
  const surfaceLayers = parseThemeLayers(surface.generatedCssPatch ?? '').layers;

  return {
    ok: true,
    sameSeedMatches: sameA.generatedCssPatch === sameB.generatedCssPatch,
    differentSeedDiffers: sameA.generatedCssPatch !== diff.generatedCssPatch,
    coordinateLayerCount: coordinateLayers.length,
    surfaceLayerCount: surfaceLayers.length,
    coordinateLayersPresent: coordinateLayers.length > 0,
    surfaceLayersPresent: surfaceLayers.length > 0,
    composerTouched: surfaceLayers.some((layer) => layer.id.includes('composer'))
  };
}

async function validatePreviewFlow() {
  const run = async (followup) => {
    const events = [];
    let messages = [];
    let previewInvocation = null;
    const conversationId = 'convo-1';
    const writableConversation = () => ({
      conversationId,
      conversation: {
        id: conversationId,
        title: 'Stable theme validation',
        collaboratorId: 'pharos',
        draft: '',
        pinnedAt: null,
        updatedAt: Date.now(),
        messages
      },
      messages
    });
    const controller = createToolPreviewController({
      local: {
        setCommandStatus(message) {
          events.push(['status', message]);
        }
      },
      chat: {
        getConversationMessages() {
          return messages;
        },
        getConversationWritable(nextConversationId) {
          return nextConversationId === conversationId ? writableConversation() : null;
        },
        getConversationTask() {
          return null;
        },
        setConversationTask() {
          return undefined;
        },
        updateMessage(_conversationId, messageId, patch) {
          events.push(['update', messageId, patch.toolInvocation?.status ?? null]);
          messages = messages.map((message) => (
            message.id === messageId
              ? { ...message, ...patch, toolInvocation: patch.toolInvocation ?? message.toolInvocation }
              : message
          ));
          return undefined;
        }
      },
      space: {
        themeToolMode: 'stable',
        getActiveThemePreview() {
          return null;
        },
        getCurrentThemeFrame() {
          return buildCustomThemeFrame();
        },
        beginThemePreview(previewId, conversationId, nextTheme, pending) {
          events.push(['begin', previewId, conversationId, Boolean(nextTheme), Boolean(pending)]);
          return { visibleThemeBeforeStart: buildCustomThemeFrame() };
        },
        commitThemePreview(previewId) {
          events.push(['commit', previewId]);
          return true;
        },
        rollbackThemePreview(previewId) {
          events.push(['rollback', previewId]);
          return true;
        },
        commitSkinSnapshot(label) {
          events.push(['snapshot', label]);
        }
      },
      derived: {
        activeConversation: { id: conversationId }
      },
      memoryActions: {
        appendCollaboratorMemories() {
          return false;
        },
        maybeHandleWriteMemoryAction() {
          return false;
        },
        applyMemoryPreview() {
          return false;
        },
        rollbackMemoryPreview() {
          return false;
        }
      },
      addRuntimeToolMessage(_conversationId, toolInvocation) {
        previewInvocation = toolInvocation;
        events.push(['message', toolInvocation.status, toolInvocation.kind]);
      }
    });

    await controller.runPreviewableToolAction(writableConversation(), {
      kind: 'applyThemeCoordinates',
      targets: 'all',
      hue: 220,
      hueCount: 3,
      emotion: -2,
      meaning: 5,
      seed: 7,
      label: '测试'
    });

    if (!previewInvocation) {
      return events;
    }

    const message = {
      id: `msg-${followup}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolInvocation: previewInvocation
    };
    messages = [message];

    if (followup === 'apply') {
      controller.applyToolPreview(message);
    }
    if (followup === 'rollback') {
      controller.rollbackToolPreview(message);
    }

    return events;
  };

  const applyEvents = await run('apply');
  const rollbackEvents = await run('rollback');

  return {
    applyEvents,
    rollbackEvents,
    previewMessageOk:
      containsMessageStatus(applyEvents, 'preview')
      && containsEvent(applyEvents, 'begin')
      && containsMessageStatus(rollbackEvents, 'preview')
      && containsEvent(rollbackEvents, 'begin'),
    applyOk:
      containsEvent(applyEvents, 'commit')
      && containsUpdateStatus(applyEvents, 'applied'),
    rollbackOk:
      containsEvent(rollbackEvents, 'rollback')
      && containsUpdateStatus(rollbackEvents, 'rolled_back')
  };
}

function containsEvent(events, type) {
  return events.some((event) => event[0] === type);
}

function containsMessageStatus(events, status) {
  return events.some((event) => event[0] === 'message' && event[1] === status);
}

function containsUpdateStatus(events, status) {
  return events.some((event) => event[0] === 'update' && event[2] === status);
}

function countPresetRouteOk(data) {
  return data.presetChecks.filter((item) => item.ok).length;
}

function renderSummary(data) {
  const presetTotal = data.presetChecks.length;
  const presetRouteOk = countPresetRouteOk(data);
  return [
    'Polaris stable theme local validation',
    `presetRouteOk=${presetRouteOk}/${presetTotal}`,
    `stableParseOk=${data.parserChecks?.parsedActionKind === 'applyThemeCoordinates' && data.parserChecks?.parsedIssues?.length === 0 && data.parserChecks?.inferredKinds?.every((kind) => kind === 'applySurfaceTokens')}`,
    `coordinateRouteOk=${data.coordinateChecks?.ok === true && data.coordinateChecks?.sameSeedMatches === true && data.coordinateChecks?.differentSeedDiffers === true && data.coordinateChecks?.coordinateLayersPresent === true}`,
    `surfaceRouteOk=${data.coordinateChecks?.ok === true && data.coordinateChecks?.surfaceLayersPresent === true && data.coordinateChecks?.composerTouched === true}`,
    `previewApplyRollbackOk=${data.previewFlowChecks?.previewMessageOk === true && data.previewFlowChecks?.applyOk === true && data.previewFlowChecks?.rollbackOk === true}`
  ].join('\n');
}
